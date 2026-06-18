import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { AlignType, CustomElement, CustomText } from '../CustomTypes';

/**
 * PDF -> Slate import (BETA), layout-aware.
 *
 * PDFs store positioned glyphs, not a semantic document. We read the text layer
 * WITH POSITIONS + FONTS via pdf.js and reconstruct structure heuristically:
 *   - headings        : font size relative to the page's body size
 *   - alignment       : line x-position relative to the page/body margins
 *   - bold / italic    : font name flags
 *   - font + size      : preserved as marks so an essay keeps its look
 *   - paragraphs      : vertical gaps between lines (with de-hyphenation)
 *   - lists           : leading bullet / number markers
 *   - page breaks      : one per source page
 *   - images          : embedded raster images (appended per page)
 *
 * It is NOT pixel-perfect: multi-column layouts, exact table grids, and text
 * color are beyond what the text layer reliably exposes. Scanned/image-only
 * PDFs have no text layer (no OCR) and raise a clear error.
 *
 * pdf.js + @napi-rs/canvas (DOMMatrix) + pdf-parse are loaded with a REAL Node
 * require (not webpack's) so the native canvas and pdf.js ESM resolve at runtime
 * instead of being bundled into the main process.
 */

declare const __non_webpack_require__: (id: string) => unknown;

const BULLET = /^\s*[-•*▪◦‣·]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

// --- Runtime loaders -----------------------------------------------------
const ensureRuntime = (): void => {
  const proc = process as unknown as { getBuiltinModule?: (id: string) => unknown };
  if (typeof proc.getBuiltinModule !== 'function') {
    proc.getBuiltinModule = (id: string) => __non_webpack_require__(id);
  }
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix === 'undefined') {
    try {
      const canvas = __non_webpack_require__('@napi-rs/canvas') as Record<string, unknown>;
      g.DOMMatrix = canvas.DOMMatrix;
      g.ImageData = canvas.ImageData;
      g.Path2D = canvas.Path2D;
    } catch {
      /* pdf.js may still self-polyfill; rendering-only globals are non-fatal */
    }
  }
};

/* eslint-disable @typescript-eslint/no-explicit-any */
// Locate pdf.js's ESM entry as a real filesystem path. In the packaged app it
// lives unpacked beside the asar (copied in by forge's packageAfterCopy hook);
// in dev it resolves from node_modules. We import it by file:// URL so Node's
// ESM loader never has to read it through the asar.
const pdfjsEntryPath = (): string => {
  const candidates: string[] = [];
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
  }
  try {
    const req = __non_webpack_require__ as unknown as { resolve(id: string): string };
    candidates.push(req.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  } catch {
    /* not resolvable in this context */
  }
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch { /* ignore */ }
  }
  return candidates[candidates.length - 1] ?? 'pdfjs-dist/legacy/build/pdf.mjs';
};

let pdfjsPromise: Promise<any> | null = null;
const loadPdfjs = (): Promise<any> => {
  if (!pdfjsPromise) {
    ensureRuntime();
    const entry = pdfjsEntryPath();
    const spec = entry.startsWith('pdfjs') ? entry : pathToFileURL(entry).href;
    // Indirect import so webpack leaves this ESM specifier alone.
    const dynamicImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    pdfjsPromise = dynamicImport(spec);
  }
  return pdfjsPromise;
};

interface PdfParser {
  getText(): Promise<{ pages: { num: number; text: string }[] }>;
  getImage(params: Record<string, unknown>): Promise<{ pages: { pageNumber: number; images: { dataUrl?: string }[] }[] }>;
  destroy(): Promise<void>;
}
type PdfParseCtor = new (opts: { data: Uint8Array; verbosity?: number }) => PdfParser;

let PdfParse: PdfParseCtor | null = null;
const loadPdfParse = (): PdfParseCtor => {
  if (PdfParse) return PdfParse;
  ensureRuntime();
  const mod = __non_webpack_require__('pdf-parse') as { PDFParse?: PdfParseCtor };
  if (!mod.PDFParse) throw new Error('pdf-parse PDFParse export is missing.');
  PdfParse = mod.PDFParse;
  return PdfParse;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Font / text helpers -------------------------------------------------
const mapFont = (family: string | undefined): string | undefined => {
  const f = (family ?? '').toLowerCase();
  if (!f || f === 'serif') return 'Times New Roman';
  if (f === 'sans-serif') return 'Arial';
  if (f === 'monospace') return 'Courier New';
  const cleaned = (family ?? '')
    .replace(/[,_-]?\s*(bold|italic|oblique|regular|medium|light|black|semibold|heavy|condensed)/gi, '')
    .replace(/MT$|PSMT$|PS$/, '')
    .replace(/[+][A-Z]{6}/, '') // strip subset prefix like ABCDEF+
    .trim();
  return cleaned || undefined;
};

interface Glyph { str: string; x: number; y: number; w: number; size: number; bold: boolean; italic: boolean; font?: string; }
interface Line { y: number; left: number; right: number; size: number; glyphs: Glyph[]; }

const sameStyle = (a: CustomText, b: CustomText): boolean =>
  !!a.bold === !!b.bold && !!a.italic === !!b.italic && a.fontFamily === b.fontFamily && a.fontSize === b.fontSize;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildLines = (textContent: any): Line[] => {
  const styles = textContent.styles ?? {};
  const lines: Line[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of textContent.items as any[]) {
    if (typeof it.str !== 'string' || it.str === '') continue;
    const t = it.transform as number[];
    const size = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 12;
    const fam = (styles[it.fontName]?.fontFamily ?? '').toLowerCase();
    const fn = (it.fontName ?? '').toLowerCase();
    const glyph: Glyph = {
      str: it.str,
      x: t[4],
      y: t[5],
      w: it.width ?? 0,
      size,
      bold: /bold|black|heavy|semibold/.test(fam) || /bold|black|heavy|semibold/.test(fn),
      italic: /italic|oblique/.test(fam) || /italic|oblique/.test(fn),
      font: mapFont(styles[it.fontName]?.fontFamily),
    };
    let line = lines.find(l => Math.abs(l.y - glyph.y) <= Math.max(2, glyph.size * 0.4));
    if (!line) {
      line = { y: glyph.y, left: glyph.x, right: glyph.x + glyph.w, size: glyph.size, glyphs: [] };
      lines.push(line);
    }
    line.glyphs.push(glyph);
    line.left = Math.min(line.left, glyph.x);
    line.right = Math.max(line.right, glyph.x + glyph.w);
    line.size = Math.max(line.size, glyph.size);
  }
  lines.forEach(l => l.glyphs.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => b.y - a.y); // top of page first (PDF y grows upward)
  return lines;
};

const lineText = (line: Line): string => line.glyphs.map(g => g.str).join('').replace(/\s+/g, ' ').trim();

const lineToRuns = (line: Line, withSize: boolean): CustomText[] => {
  const runs: CustomText[] = [];
  let prevEnd: number | null = null;
  for (const g of line.glyphs) {
    let text = g.str;
    if (prevEnd !== null) {
      const gap = g.x - prevEnd;
      const lastText = runs.length ? runs[runs.length - 1].text : '';
      if (gap > g.size * 0.25 && !/\s$/.test(lastText) && !/^\s/.test(text)) text = ' ' + text;
    }
    const run: CustomText = { text };
    if (g.bold) run.bold = true;
    if (g.italic) run.italic = true;
    if (g.font) run.fontFamily = g.font;
    if (withSize && g.size >= 4 && g.size <= 200) run.fontSize = Math.round(g.size);
    const last = runs[runs.length - 1];
    if (last && sameStyle(last, run)) last.text += run.text;
    else runs.push(run);
    prevEnd = g.x + g.w;
  }
  return runs.length ? runs : [{ text: '' }];
};

const trimRuns = (runs: CustomText[]): CustomText[] => {
  const out = runs.map(r => ({ ...r }));
  if (out.length) out[0].text = out[0].text.replace(/^\s+/, '');
  if (out.length) out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '');
  const filtered = out.filter(r => r.text !== '');
  return filtered.length ? filtered : [{ text: '' }];
};

const appendLineRuns = (acc: CustomText[], runs: CustomText[]): void => {
  if (acc.length === 0) {
    acc.push(...runs.map(r => ({ ...r })));
    return;
  }
  const last = acc[acc.length - 1];
  if (/[A-Za-z]-$/.test(last.text)) last.text = last.text.replace(/-$/, ''); // de-hyphenate wrap
  else if (!/\s$/.test(last.text)) last.text += ' ';
  for (const r of runs) {
    const l = acc[acc.length - 1];
    if (l && sameStyle(l, r)) l.text += r.text;
    else acc.push({ ...r });
  }
};

const alignOf = (line: Line, pageWidth: number, bodyLeft: number): AlignType | undefined => {
  const center = (line.left + line.right) / 2;
  const pageCenter = pageWidth / 2;
  if (line.left > bodyLeft + 24 && Math.abs(center - pageCenter) < pageWidth * 0.08) return 'center';
  if (line.left > bodyLeft + 48 && line.right > pageWidth - bodyLeft - 12) return 'right';
  return undefined;
};

const headingTypeBySize = (size: number, body: number, first: boolean): CustomElement['type'] => {
  const ratio = size / body;
  if (first || ratio >= 1.8) return 'heading-one';
  if (ratio >= 1.4) return 'heading-two';
  return 'heading-three';
};

const hasText = (block: CustomElement): boolean => {
  const walk = (n: CustomElement | CustomText): string =>
    (n as CustomText).text !== undefined
      ? (n as CustomText).text
      : ((n as CustomElement).children as (CustomElement | CustomText)[]).map(walk).join('');
  return walk(block).trim() !== '';
};

const processPage = (
  lines: Line[],
  pageWidth: number,
  bodySize: number,
  bodyLeft: number,
  firstRef: { first: boolean }
): CustomElement[] => {
  const blocks: CustomElement[] = [];
  let para: { align?: AlignType; runs: CustomText[] } | null = null;
  let list: { type: 'bulleted-list' | 'numbered-list'; items: CustomElement[] } | null = null;
  let prevY: number | null = null;
  let prevSize = bodySize;

  const flushPara = () => {
    if (para && para.runs.some(r => r.text.trim())) {
      blocks.push({ type: 'paragraph', ...(para.align ? { align: para.align } : {}), children: trimRuns(para.runs) } as CustomElement);
      firstRef.first = false;
    }
    para = null;
  };
  const flushList = () => {
    if (list && list.items.length) {
      blocks.push({ type: list.type, children: list.items } as CustomElement);
      firstRef.first = false;
    }
    list = null;
  };

  for (const line of lines) {
    const text = lineText(line);
    if (text === '') continue;
    const gap = prevY === null ? 0 : prevY - line.y;
    const isHeading = line.size >= bodySize * 1.25 && text.length < 120;
    const bullet = BULLET.test(text);
    const numbered = !bullet && NUMBERED.test(text);
    const align = alignOf(line, pageWidth, bodyLeft);

    if (bullet || numbered) {
      flushPara();
      const type = bullet ? 'bulleted-list' : 'numbered-list';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      const runs = trimRuns(lineToRuns(line, true));
      runs[0].text = runs[0].text.replace(bullet ? BULLET : NUMBERED, '');
      list.items.push({ type: 'list-item', children: runs } as CustomElement);
      prevY = line.y; prevSize = line.size;
      continue;
    }
    flushList();

    if (isHeading) {
      flushPara();
      blocks.push({
        type: headingTypeBySize(line.size, bodySize, firstRef.first),
        ...(align ? { align } : {}),
        children: trimRuns(lineToRuns(line, false)),
      } as CustomElement);
      firstRef.first = false;
      prevY = line.y; prevSize = line.size;
      continue;
    }

    const startNew = !para || (prevY !== null && gap > prevSize * 1.7) || para.align !== align;
    if (startNew) { flushPara(); para = { align, runs: [] }; }
    appendLineRuns(para!.runs, lineToRuns(line, true));
    prevY = line.y; prevSize = line.size;
  }
  flushPara();
  flushList();
  return blocks;
};

// --- Image extraction (best-effort, appended per page) -------------------
const extractImages = async (buffer: Buffer): Promise<Map<number, string[]>> => {
  const map = new Map<number, string[]>();
  try {
    const PDFParseCls = loadPdfParse();
    const parser = new PDFParseCls({ data: new Uint8Array(buffer), verbosity: 0 });
    try {
      const result = await parser.getImage({ imageDataUrl: true, imageBuffer: false, imageThreshold: 16 });
      for (const page of result.pages) {
        const urls = page.images.map(i => i.dataUrl).filter((u): u is string => !!u);
        if (urls.length) map.set(page.pageNumber, urls);
      }
    } finally {
      await parser.destroy().catch(() => { /* ignore */ });
    }
  } catch {
    /* images are optional; never block the import on them */
  }
  return map;
};

// --- Layout-aware extraction (primary path) ------------------------------
const extractWithLayout = async (buffer: Buffer): Promise<CustomElement[]> => {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const images = await extractImages(buffer);
  const out: CustomElement[] = [];
  const firstRef = { first: true };
  let anyText = false;

  for (let p = 1; p <= doc.numPages; p++) {
    if (p > 1) out.push({ type: 'page-break', children: [{ text: '' }] });
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const lines = buildLines(textContent);

    if (lines.length) {
      const sizes: number[] = [];
      for (const line of lines) {
        for (const g of line.glyphs) {
          const weight = Math.max(1, g.str.trim().length);
          for (let k = 0; k < weight; k++) sizes.push(g.size);
        }
      }
      sizes.sort((a, b) => a - b);
      const bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 12;
      const bodyCandidates = lines.filter(l => l.size <= bodySize * 1.15);
      const bodyLeft = (bodyCandidates.length ? bodyCandidates : lines).reduce((m, l) => Math.min(m, l.left), Infinity);

      const pageBlocks = processPage(lines, viewport.width, bodySize, bodyLeft, firstRef);
      if (pageBlocks.some(hasText)) anyText = true;
      out.push(...pageBlocks);
    }

    for (const url of images.get(p) ?? []) {
      out.push({ type: 'image', url, children: [{ text: '' }] });
    }
    if (typeof page.cleanup === 'function') page.cleanup();
  }
  if (typeof doc.destroy === 'function') await doc.destroy();

  if (!anyText && images.size === 0) {
    throw new Error(
      'No extractable text was found in this PDF. It may be a scanned image — ' +
        'Scribe cannot OCR scanned documents yet.'
    );
  }
  return out;
};

// --- Plain-text fallback (if the layout path fails) ----------------------
const SENTENCE_END = /[.!?:]["')\]]?\s*$/;
const PAGE_FOOTER = /^-{2,}\s*\d+\s+of\s+\d+\s*-{2,}$/i;

const extractTextOnly = async (buffer: Buffer): Promise<CustomElement[]> => {
  const PDFParseCls = loadPdfParse();
  const parser = new PDFParseCls({ data: new Uint8Array(buffer), verbosity: 0 });
  let pages: { num: number; text: string }[];
  try {
    pages = (await parser.getText()).pages;
  } finally {
    await parser.destroy().catch(() => { /* ignore */ });
  }

  if (pages.map(p => p.text).join('').replace(/\s/g, '').length < 4) {
    throw new Error(
      'No extractable text was found in this PDF. It may be a scanned image — ' +
        'Scribe cannot OCR scanned documents yet.'
    );
  }

  const blocks: CustomElement[] = [];
  pages.forEach((page, index) => {
    if (index > 0) blocks.push({ type: 'page-break', children: [{ text: '' }] });
    let buffer2 = '';
    const flush = () => { const t = buffer2.trim(); buffer2 = ''; if (t) blocks.push({ type: 'paragraph', children: [{ text: t }] }); };
    for (const line of page.text.split('\n')) {
      const t = line.trim();
      if (t === '' || PAGE_FOOTER.test(t)) { flush(); continue; }
      if (buffer2 && SENTENCE_END.test(buffer2) && /^[A-Z0-9"'(]/.test(t)) flush();
      buffer2 = buffer2 && /[A-Za-z]-$/.test(buffer2) ? buffer2.slice(0, -1) + t : buffer2 ? buffer2 + ' ' + t : t;
    }
    flush();
  });
  return blocks;
};

export const parsePdfToSlate = async (buffer: Buffer): Promise<CustomElement[]> => {
  let blocks: CustomElement[];
  try {
    blocks = await extractWithLayout(buffer);
  } catch (error) {
    // A "scanned PDF" error should surface as-is; other failures fall back.
    if (/scanned image/i.test((error as Error).message)) throw error;
    console.error('PDF layout extraction failed, falling back to plain text:', error);
    blocks = await extractTextOnly(buffer);
  }
  return blocks.length > 0 ? blocks : [{ type: 'paragraph', children: [{ text: '' }] }];
};
