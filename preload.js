const { contextBridge, ipcRenderer } = require('electron');
const call = (n, ...a) => ipcRenderer.invoke(n, ...a);
contextBridge.exposeInMainWorld('api', {
  invoke: call,
  on: cb => { const h = (_e, m) => cb(m); ipcRenderer.on('evt', h); return () => ipcRenderer.removeListener('evt', h); },
  mediaUrl: p => 'viola://media/' + encodeURIComponent(p),
});
