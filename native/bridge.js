(() => {
  if (location.origin !== 'https://jianwen.localhost' || window.top !== window) return;
  let next = 0;
  const pending = new Map(), events = new Map();
  function invoke(command, args = [], files) {
    return new Promise((resolve, reject) => {
      const id = ++next; pending.set(id, {resolve, reject});
      try {
        const message = {id, command, args};
        if (files) chrome.webview.postMessageWithAdditionalObjects(message, Array.from(files));
        else chrome.webview.postMessage(message);
      } catch (error) { pending.delete(id); reject(error); }
    });
  }
  const call = command => (...args) => invoke(command, args);
  const on = event => callback => {
    if (!events.has(event)) events.set(event, new Set());
    events.get(event).add(callback); return () => events.get(event).delete(callback);
  };
  chrome.webview.addEventListener('message', ({data}) => {
    if (data.event) { for (const callback of events.get(data.event) || []) callback(data.value); return; }
    const item = pending.get(data.id); if (!item) return;
    pending.delete(data.id); item.resolve(data.value);
  });
  Object.defineProperty(window, 'desktop', {value: Object.freeze({
    newWindow:call('window:new'),exitAll:call('window:exit-all'),recent:call('files:recent'),recentClear:call('files:recent-clear'),openPath:call('files:open-path'),
    transferPrepare:call('tabs:prepare'),transferImport:call('tabs:import'),transferCommit:call('tabs:commit'),onTransferred:on('tabs:transferred'),onImport:on('tabs:import'),
    spellLanguages:call('spelling:languages'),spellCheck:call('spelling:check'),spellWords:call('spelling:words'),spellWordAdd:call('spelling:word-add'),pageSetup:call('print:setup'),printSettings:call('print:settings'),
    print:call('files:print'),openLink:call('markdown:link'),loadImage:call('markdown:image'),
    largePage: call('large:page'), largeStage: call('large:stage'), largeSave: call('large:save'), largeEncoding: call('large:encoding'), largeRelease: call('large:release'),
    host: 'webview2', startupTrace: phase => invoke('startup:mark', [{phase}]), uiReady: call('window:ready'), boot: call('boot'), open: call('files:open'), save: call('files:save'), fonts: call('fonts:list'),
    settings: call('settings:get'), saveSettings: call('settings:save'), testConnection: call('ai:test'),
    ask: call('ai:ask'), cancel: call('ai:cancel'), persist: call('session:save'),
    closeAnswer: call('window:close-answer'), confirmClose: call('files:confirm-close'), windowTheme: call('window:theme'),
    windowAction: call('window:action'), windowResize: call('window:resize'), windowSurface: call('window:surface'), dropped: files => invoke('files:drop', [], files),
    onSettings:on('settings:changed'),onOpen: on('files:opened'), onClose: on('window:request-close'), onWindowState: on('window:state'), __test: call('test')
  })});
})();
