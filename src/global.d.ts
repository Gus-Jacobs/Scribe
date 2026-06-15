export interface FileResult {
  success: boolean;
  error?: string;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
}

export interface OpenResult extends FileResult {
  content?: unknown;
  fileType?: 'slate' | 'html-import';
}

export interface IElectronAPI {
  saveFile: (content: unknown[]) => Promise<FileResult>;
  saveAsFile: (content: unknown[]) => Promise<FileResult>;
  openFile: () => Promise<OpenResult>;
  newDocument: () => Promise<FileResult>;
  setDirty: (dirty: boolean) => Promise<FileResult>;
  exportPdf: (content: unknown[]) => Promise<FileResult>;
  openImageDialog: () => Promise<string | null>;
  writeText: (text: string) => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
