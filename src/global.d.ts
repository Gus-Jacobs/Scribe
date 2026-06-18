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

export interface AppInfo {
  version: string;
  platform: string;
  arch: string;
  electron: string;
}

export interface UpdateStatus {
  status: 'checking' | 'none' | 'available' | 'downloaded' | 'error' | string;
  detail?: string;
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
  openExternal: (url: string) => Promise<{ success: boolean }>;
  getAppInfo: () => Promise<AppInfo>;
  checkForUpdates: () => Promise<{ supported: boolean; reason?: string }>;
  restartToUpdate: () => Promise<{ success: boolean }>;
  onUpdateStatus: (callback: (data: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
