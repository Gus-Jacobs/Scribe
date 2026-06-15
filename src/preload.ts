import { contextBridge, ipcRenderer, clipboard } from 'electron';

// The single, security-boundary-respecting bridge between the renderer and
// the main process. The renderer never touches Node APIs directly.
contextBridge.exposeInMainWorld('api', {
  saveFile: (content: unknown[]) => ipcRenderer.invoke('save-file', { content }),
  saveAsFile: (content: unknown[]) => ipcRenderer.invoke('save-as-file', { content }),
  openFile: () => ipcRenderer.invoke('open-file'),
  newDocument: () => ipcRenderer.invoke('new-document'),
  setDirty: (dirty: boolean) => ipcRenderer.invoke('set-dirty', dirty),
  exportPdf: (content: unknown[]) => ipcRenderer.invoke('export-pdf', { content }),
  openImageDialog: () => ipcRenderer.invoke('open-image-dialog'),
  writeText: (text: string) => clipboard.writeText(text),
});
