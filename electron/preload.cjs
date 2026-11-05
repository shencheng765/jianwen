const {contextBridge, ipcRenderer, webUtils} = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('desktop', {
  boot:invoke('boot'), open:invoke('files:open'), save:invoke('files:save'), fonts:invoke('fonts:list'),
  settings:invoke('settings:get'), saveSettings:invoke('settings:save'), testConnection:invoke('ai:test'),
  ask:invoke('ai:ask'), cancel:invoke('ai:cancel'), persist:invoke('session:save'),
  closeAnswer:invoke('window:close-answer'), confirmClose:invoke('files:confirm-close'),
  windowTheme:invoke('window:theme'),
  dropped:files => ipcRenderer.invoke('files:drop', Array.from(files).map(f=>webUtils.getPathForFile(f))),
  onOpen:callback=>{const fn=(_,files)=>callback(files);ipcRenderer.on('files:opened',fn);return()=>ipcRenderer.removeListener('files:opened',fn);},
  onClose:callback=>{const fn=()=>callback();ipcRenderer.on('window:request-close',fn);return()=>ipcRenderer.removeListener('window:request-close',fn);}
});
