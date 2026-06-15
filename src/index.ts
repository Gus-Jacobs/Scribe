import { app, BrowserWindow, ipcMain, dialog, session, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import util from 'util';
import HTMLToDOCX from '@turbodocx/html-to-docx';

import { parseDocxToSlate } from './docxParser';
import { processWithPandoc } from './parsers/pandocEngine';
import { processTextFile, processMarkdownFile, processHtmlFile } from './parsers/textEngine';
import JSZip from 'jszip';
import { generateHtmlString, HANGING_INDENT_SENTINEL_TWIPS } from './exporters/htmlSerializer';
import { generateMarkdownString, generatePlainTextString } from './exporters/markdownSerializer';
import type { CustomElement } from './CustomTypes';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const execPromise = util.promisify(exec);

// Content arrives over IPC as plain JSON; the editor guarantees this shape.
type SlateContent = CustomElement[];

interface FileResult {
  success: boolean;
  error?: string;
  filePath?: string;
  fileName?: string;
  canceled?: boolean;
}

// --- Document session state (single-document app) ---
let currentFilePath: string | null = null;
let isDirty = false;

const updateTitle = (win: BrowserWindow | null): void => {
  if (!win || win.isDestroyed()) return;
  const name = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
  win.setTitle(`${isDirty ? '• ' : ''}${name} — Scribe`);
  win.setDocumentEdited(isDirty);
  if (currentFilePath) win.setRepresentedFilename(currentFilePath);
};

const windowFor = (event: IpcMainInvokeEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(event.sender);

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 480,
    title: 'Untitled — Scribe',
    icon: path.resolve(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Never lose work silently: closing with unsaved changes asks first.
  mainWindow.on('close', event => {
    if (!isDirty) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Discard Changes', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'You have unsaved changes.',
      detail: 'Your changes will be lost if you close without saving.',
    });
    if (choice === 1) event.preventDefault();
  });
};

// --- Writers (one per export format) ---

/**
 * Rewrites constructs html-to-docx cannot express directly:
 * hanging-indent paragraphs are emitted with a sentinel left indent
 * (see htmlSerializer) and converted here into real `w:hanging` indents.
 */
const applyDocxFixups = async (buffer: Buffer): Promise<Buffer> => {
  const sentinel = new RegExp(`<w:ind w:left="${HANGING_INDENT_SENTINEL_TWIPS}"\\s*/>`, 'g');
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) return buffer;
  const xml = await docFile.async('string');
  if (!xml.includes(`<w:ind w:left="${HANGING_INDENT_SENTINEL_TWIPS}"`)) return buffer;
  zip.file('word/document.xml', xml.replace(sentinel, '<w:ind w:left="720" w:hanging="720"/>'));
  return zip.generateAsync({ type: 'nodebuffer' });
};

const writeDocx = async (filePath: string, content: SlateContent): Promise<void> => {
  const html = generateHtmlString(content, path.basename(filePath, '.docx'), { docx: true });
  const raw = await HTMLToDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    font: 'Calibri',
  });
  const buffer = await applyDocxFixups(Buffer.from(raw as ArrayBuffer));
  fs.writeFileSync(filePath, buffer);
};

const writeViaPandoc = async (filePath: string, content: SlateContent): Promise<void> => {
  const html = generateHtmlString(content);
  const tempPath = path.join(app.getPath('temp'), `scribe-export-${Date.now()}.html`);
  fs.writeFileSync(tempPath, html);
  try {
    await execPromise(`pandoc "${tempPath}" -o "${filePath}"`);
  } catch (error) {
    throw new Error(
      `Exporting to ${path.extname(filePath)} requires Pandoc to be installed (https://pandoc.org). ` +
        `Original error: ${(error as Error).message}`
    );
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
};

const writeContentToPath = async (filePath: string, content: SlateContent): Promise<void> => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.docx':
      await writeDocx(filePath, content);
      break;
    case '.odt':
    case '.rtf':
      await writeViaPandoc(filePath, content);
      break;
    case '.txt':
      fs.writeFileSync(filePath, generatePlainTextString(content), 'utf-8');
      break;
    case '.md':
      fs.writeFileSync(filePath, generateMarkdownString(content), 'utf-8');
      break;
    case '.html':
      fs.writeFileSync(filePath, generateHtmlString(content, path.basename(filePath, '.html')), 'utf-8');
      break;
    case '.scribe':
    case '.json':
    default:
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
      break;
  }
};

const SAVE_FILTERS = [
  { name: 'Scribe Native Document', extensions: ['scribe'] },
  { name: 'Word Document', extensions: ['docx'] },
  { name: 'OpenDocument Text', extensions: ['odt'] },
  { name: 'Rich Text Format', extensions: ['rtf'] },
  { name: 'Markdown', extensions: ['md'] },
  { name: 'HTML', extensions: ['html'] },
  { name: 'Plain Text', extensions: ['txt'] },
];

// Formats Scribe can write back to silently on Cmd/Ctrl+S.
const RESAVABLE_EXTENSIONS = new Set(['.scribe', '.json', '.docx', '.odt', '.rtf', '.txt', '.md', '.html']);

const handleSave = async (
  event: IpcMainInvokeEvent,
  content: SlateContent,
  forceDialog: boolean
): Promise<FileResult> => {
  try {
    let filePath = currentFilePath;

    if (forceDialog || !filePath) {
      const result = await dialog.showSaveDialog(windowFor(event)!, {
        title: forceDialog ? 'Save As' : 'Save Document',
        defaultPath: currentFilePath ?? 'Untitled.scribe',
        filters: SAVE_FILTERS,
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      filePath = result.filePath;
    }

    await writeContentToPath(filePath, content);
    currentFilePath = filePath;
    isDirty = false;
    updateTitle(windowFor(event));
    return { success: true, filePath, fileName: path.basename(filePath) };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: (error as Error).message };
  }
};

ipcMain.handle('save-file', (event, { content }) => handleSave(event, content, false));
ipcMain.handle('save-as-file', (event, { content }) => handleSave(event, content, true));

// --- Open ---
ipcMain.handle('open-file', async event => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(windowFor(event)!, {
      title: 'Open Document',
      properties: ['openFile'],
      filters: [
        { name: 'All Supported', extensions: ['scribe', 'json', 'docx', 'odt', 'epub', 'tex', 'rtf', 'txt', 'md', 'html'] },
        { name: 'Scribe Native Document', extensions: ['scribe'] },
        { name: 'Word Documents', extensions: ['docx'] },
        { name: 'OpenDocument Text', extensions: ['odt'] },
        { name: 'eBooks', extensions: ['epub'] },
        { name: 'LaTeX', extensions: ['tex'] },
        { name: 'Rich Text Format', extensions: ['rtf'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'HTML Files', extensions: ['html'] },
      ],
    });
    if (canceled || filePaths.length === 0) return { success: false, canceled: true };

    const filePath = filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    let content: unknown;
    let fileType: 'slate' | 'html-import';

    switch (ext) {
      case '.txt':
        content = processTextFile(filePath);
        fileType = 'slate';
        break;
      case '.md':
        content = processMarkdownFile(filePath);
        fileType = 'html-import';
        break;
      case '.html':
        content = processHtmlFile(filePath);
        fileType = 'html-import';
        break;
      case '.scribe':
      case '.json':
        content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fileType = 'slate';
        break;
      case '.docx':
        content = await parseDocxToSlate(fs.readFileSync(filePath));
        fileType = 'slate';
        break;
      case '.odt':
      case '.epub':
      case '.tex':
      case '.rtf':
        content = await processWithPandoc(filePath);
        fileType = 'html-import';
        break;
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }

    currentFilePath = RESAVABLE_EXTENSIONS.has(ext) ? filePath : null;
    isDirty = false;
    updateTitle(windowFor(event));

    return { success: true, content, fileType, filePath, fileName: path.basename(filePath) };
  } catch (error) {
    console.error('Open error:', error);
    return { success: false, error: (error as Error).message };
  }
});

// --- New document ---
ipcMain.handle('new-document', event => {
  currentFilePath = null;
  isDirty = false;
  updateTitle(windowFor(event));
  return { success: true };
});

// --- Dirty tracking (drives the window title and macOS edited dot) ---
ipcMain.handle('set-dirty', (event, dirty: boolean) => {
  if (isDirty !== dirty) {
    isDirty = dirty;
    updateTitle(windowFor(event));
  }
  return { success: true };
});

// --- PDF export ---
// Renders the serialized document in a hidden window so the PDF is clean print
// output (no toolbar, no theme backgrounds), then prints it natively.
ipcMain.handle('export-pdf', async (event, { content }) => {
  let printWindow: BrowserWindow | null = null;
  let tempPath: string | null = null;
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(windowFor(event)!, {
      title: 'Export to PDF',
      defaultPath: currentFilePath
        ? currentFilePath.replace(/\.[^.]+$/, '.pdf')
        : 'Untitled.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };

    const html = generateHtmlString(content, path.basename(filePath, '.pdf'));
    tempPath = path.join(app.getPath('temp'), `scribe-pdf-${Date.now()}.html`);
    fs.writeFileSync(tempPath, html);

    printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
    });
    await printWindow.loadFile(tempPath);

    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      pageSize: 'Letter',
    });
    fs.writeFileSync(filePath, pdfData);
    return { success: true, filePath, fileName: path.basename(filePath) };
  } catch (error) {
    console.error('PDF export error:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// --- Image picker (returns a base64 data URI for safe embedding in .scribe) ---
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

ipcMain.handle('open-image-dialog', async event => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(windowFor(event)!, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
    });
    if (canceled || filePaths.length === 0) return null;
    const filePath = filePaths[0];
    const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? 'image/png';
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  } catch (error) {
    console.error('Image dialog error:', error);
    return null;
  }
});

// --- App lifecycle ---
app.on('ready', () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:"],
      },
    });
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
