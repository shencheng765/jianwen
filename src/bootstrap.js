import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import 'monaco-editor/nls/lang/zh-cn.js';
globalThis.MonacoEnvironment = {getWorker:()=>new EditorWorker()};
if(window.__jianwenTrace)window.desktop.startupTrace('bootstrap');
// Read and validate the local session while the editor module is loading.
globalThis.jianwenBoot=window.desktop.boot().then(state=>{globalThis.jianwenBootState=state;return state;});
import('./app.js');