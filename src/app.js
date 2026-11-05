import * as monaco from 'monaco-editor/editor';
import 'monaco-editor/features/find/register.js';
import 'monaco-editor/features/clipboard/register.js';
import 'monaco-editor/features/linesOperations/register.js';
import 'monaco-editor/features/wordOperations/register.js';
import 'monaco-editor/features/hover/register.js';
import 'monaco-editor/features/bracketMatching/register.js';
import 'monaco-editor/features/tokenization/register.js';
import 'monaco-editor/languages/definitions/powershell/register.js';
import 'monaco-editor/languages/definitions/shell/register.js';
import 'monaco-editor/languages/definitions/bat/register.js';
import 'monaco-editor/languages/definitions/yaml/register.js';
import 'monaco-editor/languages/definitions/ini/register.js';
import 'monaco-editor/languages/definitions/markdown/register.js';
import 'monaco-editor/languages/definitions/sql/register.js';
import 'monaco-editor/languages/definitions/python/register.js';
import 'monaco-editor/languages/definitions/xml/register.js';
import 'monaco-editor/languages/definitions/javascript/register.js';
import 'monaco-editor/languages/definitions/typescript/register.js';
import 'monaco-editor/languages/definitions/cpp/register.js';
import 'monaco-editor/languages/definitions/csharp/register.js';
import 'monaco-editor/languages/definitions/java/register.js';
import 'monaco-editor/languages/definitions/go/register.js';
import 'monaco-editor/languages/definitions/rust/register.js';
import 'monaco-editor/languages/definitions/php/register.js';
import 'monaco-editor/languages/definitions/ruby/register.js';
import 'monaco-editor/languages/definitions/html/register.js';
import 'monaco-editor/languages/definitions/css/register.js';
import './style.css';
import './chat.css';
import './settings-theme.css';
import './notepad-features.css';
import {installFeatures} from './notepad-features.js';
import {installClipboard} from './clipboard.js';
import appIcon from '../assets/icon.png';
import {mountInterface,setupMenus} from './ui.js';
import {defaultAppearance,restoreAppearance,fontPixels,normalizeFontSize} from './appearance.js';
import {renderConversation,showPending} from './chat.js';

const api=window.desktop;
if(window.__jianwenTrace)api.startupTrace('app-module');
const $=id=>document.getElementById(id);
const icons={
  logo:`<img class="brand-icon" src="${appIcon}" alt="简文" width="20" height="20">`,
  plus:'<svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>',
  open:'<svg viewBox="0 0 20 20"><path d="M2.5 15.5V5h6l2 2h7v2M2.5 16l3-7h12.5l-3 7H2.5Z"/></svg>',
  save:'<svg viewBox="0 0 20 20"><path d="M3 3h12l2 2v12H3V3Z M6 3v5h8V3M6 17v-6h8v6"/></svg>',
  spark:'<svg viewBox="0 0 20 20"><path d="m10 2 2.3 5.7L18 10l-5.7 2.3L10 18l-2.3-5.7L2 10l5.7-2.3L10 2Z"/></svg>',
  settings:'<svg viewBox="0 0 20 20"><path d="m8 2-.6 2-2 .9-1.9-.5L2 7l1.3 1.5v3L2 13l1.5 2.6 2-.5 2 .9.5 2h4l.6-2 2-.9 1.9.5L18 13l-1.3-1.5v-3L18 7l-1.5-2.6-2 .5-2-.9-.5-2H8Z"/><circle cx="10" cy="10" r="3"/></svg>',
  close:'<svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg>',
  arrow:'<svg viewBox="0 0 20 20"><path d="m4 10 6-6 6 6M10 4v13"/></svg>',
  check:'<svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg>',
  search:'<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>',
  chevron:'<svg class="chevron" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>',
  palette:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-.8-.5-.5-2 .5-2H17a4 4 0 0 0 4-4 9 9 0 0 0-9-8Z"/><circle cx="7" cy="11" r=".7"/><circle cx="9" cy="7" r=".7"/><circle cx="14" cy="6" r=".7"/><circle cx="18" cy="10" r=".7"/></svg>',
  wrap:'<svg viewBox="0 0 24 24"><path d="M3 5h18M3 11h14a4 4 0 0 1 0 8h-5m3-3-3 3 3 3M3 17h5"/></svg>',
  lines:'<svg viewBox="0 0 24 24"><path d="M9 5h12M9 12h12M9 19h12M3 4h1v3M3 11h2l-2 3h2M3 18h2v3H3"/></svg>'
};

mountInterface(icons);
setupMenus();
if(api.host==='webview2'){
  document.documentElement.dataset.host='webview2';
  const caption=document.createElement('div');caption.className='window-controls';
  for(const [command,label,shape] of [['minimize','最小化','<path d="M3 8h10"/>'],['maximize','最大化或还原','<rect x="3.5" y="3.5" width="9" height="9"/>'],['close','关闭','<path d="m3.5 3.5 9 9m0-9-9 9"/>']]){
    const button=document.createElement('button');button.className='window-control '+command;button.title=label;button.setAttribute('aria-label',label);button.innerHTML=`<svg viewBox="0 0 16 16">${shape}</svg>`;
    button.onclick=()=>api.windowAction(command);caption.append(button);
  }
  document.querySelector('.titlebar').append(caption);
  // Keep resizing outside the WebView2 callback's native modal loops.
  for(const edge of ['left','right','top','bottom','top-left','top-right','bottom-left','bottom-right']){
    const handle=document.createElement('div');handle.className='window-resize '+edge;handle.setAttribute('aria-hidden','true');
    handle.onpointerdown=event=>{
      if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);
      const x=event.screenX,y=event.screenY;api.windowResize({phase:'start',edge});
      const move=event=>api.windowResize({phase:'move',dx:event.screenX-x,dy:event.screenY-y});
      const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.removeEventListener('lostpointercapture',end);api.windowResize({phase:'end'});};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
    };
    document.body.append(handle);
  }
  api.onWindowState?.(state=>{document.documentElement.dataset.maximized=String(state.maximized);});
}

const languages=[['command-text','文本 / 命令'],['plaintext','纯文本'],['powershell','PowerShell'],['bat','批处理 / CMD'],['shell','Shell / Bash'],['json','JSON'],['yaml','YAML'],['ini','配置 / INI'],['markdown','Markdown'],['python','Python'],['javascript','JavaScript'],['typescript','TypeScript'],['html','HTML'],['css','CSS'],['sql','SQL'],['xml','XML'],['cpp','C / C++'],['csharp','C#'],['java','Java'],['go','Go'],['rust','Rust'],['php','PHP'],['ruby','Ruby']];
for(const [id,name] of languages){const option=document.createElement('option');option.value=id;option.textContent=name;$('language').append(option);}
monaco.languages.register({id:'json'});
monaco.languages.setMonarchTokensProvider('json',{tokenizer:{root:[[/"(?:[^"\\]|\\.)*"(?=\s*:)/,'attribute.name'],[/"(?:[^"\\]|\\.)*"/,'string'],[/\b(?:true|false|null)\b/,'keyword'],[/-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,'number'],[/[{}\[\]]/,'delimiter.bracket']]}});
monaco.languages.register({id:'command-text'});
monaco.languages.setMonarchTokensProvider('command-text',{
  tokenizer:{root:[
    [/^\s*(#|;|\/\/).*$/,'comment'],[/https?:\/\/[^\s"'<>]+/,'string.link'],
    [/"([^"\\]|\\.)*"|'[^']*'/,'string'],[/\$[A-Za-z_][\w:]*/,'variable'],[/%[A-Za-z_][\w]*%/,'variable'],
    [/\b(?:Get|Set|New|Remove|Copy|Move|Test|Write|Read|Start|Stop|Invoke|Select|Where|ForEach|Add|Clear|Out|Import|Export|Restart|Connect)-[A-Za-z]+\b/,'keyword'],
    [/\b(?:cd|dir|echo|mkdir|rmdir|del|copy|move|type|set|if|else|for|in|do|done|exit|return|sudo|rm|ls|cat|grep|curl|wget|git|npm|pnpm|node|python|pip|adb|ssh|docker|netsh|ipconfig|ping|taskkill|robocopy)\b/,'keyword'],
    [/(^|\s)(--?[a-zA-Z][\w-]*|\/[A-Za-z][\w:]*)/,'attribute.name'],
    [/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/,'number'],[/\b\d+(?:\.\d+)?\b/,'number'],
    [/[|&><=]+/,'operator'],[/[{}\[\]()]/,'delimiter.bracket']
  ]}
});
monaco.editor.defineTheme('jianwen',{
  base:'vs',inherit:true,rules:[{token:'comment',foreground:'7C838E'},{token:'keyword',foreground:'3E68AC'},{token:'string',foreground:'A25B43'},{token:'number',foreground:'986B32'},{token:'variable',foreground:'805AB0'},{token:'attribute.name',foreground:'81628E'},{token:'operator',foreground:'657080'}],
  colors:{'editor.background':'#FFFFFF','editor.foreground':'#000000','editorLineNumber.foreground':'#888888','editorLineNumber.activeForeground':'#444444','editor.lineHighlightBackground':'#FFFFFF','editor.selectionBackground':'#97C6EA','editor.inactiveSelectionBackground':'#97C6EA','editorCursor.foreground':'#000000','editorIndentGuide.background1':'#ECEEF2','editorWidget.background':'#FFFFFF','editorWidget.border':'#DDE1E8','editorGutter.background':'#FFFFFF','scrollbarSlider.background':'#9AA4B344','scrollbarSlider.hoverBackground':'#9AA4B380','focusBorder':'#7890B8'}
});
monaco.editor.defineTheme('jianwen-dark',{
  base:'vs-dark',inherit:true,rules:[{token:'comment',foreground:'A0A0A0'},{token:'keyword',foreground:'8FBBEA'},{token:'string',foreground:'E0B298'},{token:'number',foreground:'D4BC89'},{token:'variable',foreground:'C1A3E0'},{token:'attribute.name',foreground:'C6ADD5'},{token:'operator',foreground:'D0D0D0'}],
  colors:{'editor.background':'#202020','editor.foreground':'#EEEEEE','editorLineNumber.foreground':'#858585','editorLineNumber.activeForeground':'#D3D3D3','editor.lineHighlightBackground':'#282828','editor.selectionBackground':'#364E6A','editorCursor.foreground':'#FFFFFF','editorIndentGuide.background1':'#363636','editorWidget.background':'#2C2C2C','editorWidget.border':'#484848','editorGutter.background':'#202020','scrollbarSlider.background':'#FFFFFF30','scrollbarSlider.hoverBackground':'#FFFFFF50','focusBorder':'#83B8E8'}
});
// Usually available by the time the editor module finishes loading. Match the
// saved appearance on the first layout instead of measuring a throwaway font.
const initialAppearance=restoreAppearance(globalThis.jianwenBootState?.session?.appearance);
const initialFontPixels=fontPixels(initialAppearance);
monaco.editor.EditorZoom.setZoomLevel((initialAppearance.zoom-100)/10);
const editor=monaco.editor.create($('editor'),{
  model:null,
  theme:initialAppearance.theme==='dark'?'jianwen-dark':'jianwen',fontFamily:`"${initialAppearance.fontFamily}", "Microsoft YaHei UI", monospace`,fontSize:initialFontPixels,fontWeight:initialAppearance.fontStyle.includes('Bold')?'700':'400',lineHeight:Math.round(initialFontPixels*1.35),mouseWheelZoom:false,
  padding:{top:16,bottom:24},minimap:{enabled:false},automaticLayout:true,scrollBeyondLastLine:false,
  // Keep Monaco's line selection gutter clickable even when its numbers are hidden.
  wordWrap:initialAppearance.wrap?'on':'off',renderLineHighlight:'none',lineNumbers:initialAppearance.lineNumbers?'on':()=>'',lineNumbersMinChars:initialAppearance.lineNumbers?3:2,lineDecorationsWidth:initialAppearance.lineNumbers?12:0,selectOnLineNumbers:true,glyphMargin:false,folding:false,
  overviewRulerLanes:0,overviewRulerBorder:false,hideCursorInOverviewRuler:true,renderValidationDecorations:'on',
  roundedSelection:true,stickyScroll:{enabled:false},quickSuggestions:false,suggestOnTriggerCharacters:false,
  wordBasedSuggestions:'off',parameterHints:{enabled:false},bracketPairColorization:{enabled:false},
  unicodeHighlight:{ambiguousCharacters:false,invisibleCharacters:false},contextmenu:false,
  // Use the mature textarea/IME path in the embedded Windows WebView.
  editContext:false,accessibilitySupport:'auto',ariaLabel:'文本编辑区',tabSize:4,detectIndentation:true
});
const docs=[];
let active=null,settings={},busy=null,persistTimer,autoTimer,lastAutoAt=0,toastTimer,waitTicker,readyForPersistence=false;
let appearance={...defaultAppearance},fontStyles={},appliedNativeTheme,features,windowSessionId='';
const current=()=>docs.find(d=>d.id===active);
const textOf=d=>d._model?d._model.getValue():d.initialText;
const dirty=d=>!!d.large?.dirty||textOf(d)!==(d.large?d.stagedText:d.savedText);
const extLanguage=name=>({ps1:'powershell',bat:'bat',cmd:'bat',sh:'shell',bash:'shell',json:'json',yaml:'yaml',yml:'yaml',ini:'ini',conf:'ini',cfg:'ini',md:'markdown',sql:'sql',py:'python',xml:'xml',js:'javascript',jsx:'javascript',mjs:'javascript',ts:'typescript',tsx:'typescript',html:'html',htm:'html',css:'css',c:'cpp',h:'cpp',cc:'cpp',cpp:'cpp',hpp:'cpp',cs:'csharp',java:'java',go:'go',rs:'rust',php:'php',rb:'ruby'}[name.split('.').pop()?.toLowerCase()]||'command-text');
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
async function call(promise){const r=await promise;if(r?.error)throw new Error(r.error);return r;}
function action(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>toast(e.message));}
function serialize(){return {active,appearance,aiVisible:!$('layout').classList.contains('ai-hidden'),docs:docs.map(d=>({id:d.id,name:d.name,path:d.path,text:d.large?undefined:textOf(d),savedText:d.large?undefined:d.savedText,large:d.large,language:d.language,encoding:d.encoding,bom:d.bom,fingerprint:d.fingerprint}))};}
function applyAppearance(){
  features?.apply();
  document.querySelector('.statusbar').hidden=appearance.statusBar===false;
  $('menu-status').setAttribute('aria-checked',String(appearance.statusBar!==false));
  const styles=fontStyles[appearance.fontFamily]||['Regular','Italic','Bold','Bold Italic'];
  if(!styles.includes(appearance.fontStyle))appearance.fontStyle=styles[0]||'Regular';
  $('font-style').replaceChildren(...styles.map(style=>new Option(style,style)));$('font-style').value=appearance.fontStyle;
  const pixels=fontPixels(appearance),italic=appearance.fontStyle.includes('Italic'),bold=appearance.fontStyle.includes('Bold');
  monaco.editor.EditorZoom.setZoomLevel((appearance.zoom-100)/10);
  editor.updateOptions({fontFamily:`"${appearance.fontFamily}", "Microsoft YaHei UI", monospace`,fontSize:pixels,fontWeight:bold?'700':'400',lineHeight:Math.round(pixels*1.35),lineNumbers:appearance.lineNumbers?'on':()=>'',lineNumbersMinChars:appearance.lineNumbers?3:2,lineDecorationsWidth:appearance.lineNumbers?12:0,wordWrap:appearance.wrap?'on':'off'});
  $('editor').style.setProperty('--editor-font-style',italic?'italic':'normal');
  Object.assign($('font-preview').style,{fontFamily:`"${appearance.fontFamily}", "Microsoft YaHei UI", monospace`,fontSize:appearance.fontSize+'pt',fontStyle:italic?'italic':'normal',fontWeight:bold?'700':'400'});
  $('font-size').value=appearance.fontSize;$('line-numbers').checked=appearance.lineNumbers;
  $('zoom').textContent=appearance.zoom+'%';$('zoom').setAttribute('aria-label',`缩放 ${appearance.zoom}%，点击恢复默认`);
  if(!Array.from($('font-family').options).some(x=>x.value===appearance.fontFamily)){const option=new Option(appearance.fontFamily,appearance.fontFamily);$('font-family').add(option);}
  $('font-family').value=appearance.fontFamily;
  $('theme').value=appearance.theme;document.documentElement.dataset.theme=appearance.theme;
  monaco.editor.setTheme(appearance.theme==='dark'?'jianwen-dark':'jianwen');
  $('theme-light').setAttribute('aria-checked',appearance.theme==='light');$('theme-dark').setAttribute('aria-checked',appearance.theme==='dark');
  $('menu-lines').setAttribute('aria-checked',appearance.lineNumbers);$('menu-wrap').setAttribute('aria-checked',appearance.wrap);
  $('wrap-setting').checked=appearance.wrap;$('wrap').textContent=appearance.wrap?'自动换行':'不换行';
  if(appliedNativeTheme!==appearance.theme){appliedNativeTheme=appearance.theme;api.windowTheme(appearance.theme).then(result=>{document.documentElement.dataset.material=result.material||'none';}).catch(()=>{appliedNativeTheme=null;});}applyPanelSize();
}
function applyPanelSize(){
  const available=$('layout').clientWidth;
  const width=Math.max(280,Math.min(appearance.aiWidth,Math.min(900,Math.max(280,available-305))));
  const height=Math.max(80,Math.min(appearance.inputHeight,Math.max(80,$('layout').clientHeight-300)));
  $('layout').style.setProperty('--ai-width',width+'px');$('question').style.height=height+'px';
  $('ai-width').value=appearance.aiWidth;$('input-height').value=appearance.inputHeight;
  $('ai-resizer').setAttribute('aria-valuenow',Math.round(width));$('composer-resizer').setAttribute('aria-valuenow',Math.round(height));
}
function setAIVisible(visible){$('layout').classList.toggle('ai-hidden',!visible);$('toggle-ai').setAttribute('aria-pressed',visible);applyPanelSize();persist();}
function bindResize(id,dimension){
  const handle=$(id),vertical=dimension==='aiWidth';
  handle.onpointerdown=event=>{
    if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);
    const start=vertical?event.clientX:event.clientY,initial=vertical?$('ai-panel').getBoundingClientRect().width:$('question').getBoundingClientRect().height;
    document.body.classList.add(vertical?'resizing-width':'resizing-height');
    const move=event=>{
      const delta=start-(vertical?event.clientX:event.clientY);
      appearance[dimension]=Math.round(Math.max(vertical?280:80,Math.min(vertical?Math.min(900,$('layout').clientWidth-305):Math.min(420,Math.max(80,$('layout').clientHeight-300)),initial+delta)));
      applyPanelSize();
    };
    const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);document.body.classList.remove('resizing-width','resizing-height');persist();};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  };
  handle.ondblclick=()=>{appearance[dimension]=vertical?360:120;applyPanelSize();persist();};
  handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();appearance[dimension]=event.key==='Home'?(vertical?360:120):Math.max(vertical?280:80,Math.min(vertical?900:420,appearance[dimension]+(['ArrowLeft','ArrowUp'].includes(event.key)?20:-20)));applyPanelSize();persist();};
}
bindResize('ai-resizer','aiWidth');bindResize('composer-resizer','inputHeight');
new ResizeObserver(applyPanelSize).observe($('layout'));
async function loadFonts(){
  const response=await call(api.fonts());
  fontStyles=response.styles||{};
  const names=[...new Set(['Microsoft YaHei','Consolas',appearance.fontFamily,...response.fonts])];
  const popular=['Microsoft YaHei','Microsoft YaHei UI','Consolas','Cascadia Code','Cascadia Mono','SimSun','SimHei','KaiTi','FangSong','Segoe UI','Arial','Courier New','Times New Roman'];
  names.sort((a,b)=>{const x=popular.indexOf(a),y=popular.indexOf(b);return x>=0||y>=0?(x<0?999:x)-(y<0?999:y):a.localeCompare(b,'zh-CN');});
  const friendly={'Microsoft YaHei UI':'微软雅黑 UI','Microsoft YaHei':'微软雅黑','SimSun':'宋体','SimHei':'黑体','KaiTi':'楷体','FangSong':'仿宋'};
  $('font-family').replaceChildren(...names.map(name=>new Option(friendly[name]||name,name)));
  applyAppearance();
}
let fontsLoading;
function ensureFonts(){
  if(!fontsLoading)fontsLoading=loadFonts().catch(()=>{fontsLoading=null;toast('系统字体列表暂未读到，仍可使用默认字体。');});
  return fontsLoading;
}
let largeTail=Promise.resolve(),largeWorking=false;
function largeQueue(task){const next=largeTail.then(task);largeTail=next.catch(()=>{});return next;}
async function flushLarge(d){
  if(!d.large)return;
  const text=textOf(d);if(text===d.stagedText)return;
  const result=await call(api.largeStage({id:d.large.id,index:d.large.index,text}));
  d.large.dirty=result.dirty;d.stagedText=text;renderTabs();if(d===current())updateStatus();
}
async function persistSnapshot(close=false){
  return largeQueue(async()=>{for(const d of docs)await flushLarge(d);return call(close?api.closeAnswer(serialize()):api.persist(serialize()));});
}
function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>{persistSnapshot().catch(e=>toast('恢复记录保存失败：'+e.message));},900);}
async function largeOperation(d,task){
  return largeQueue(async()=>{
    if(!docs.includes(d))return;
    largeWorking=true;if(busy)await cancelRequest();clearTimeout(autoTimer);
    editor.updateOptions({readOnly:true});features?.syncRtl();renderLarge();
    try{return await task();}finally{largeWorking=false;editor.updateOptions({readOnly:closing});features?.syncRtl();renderLarge();}
  });
}
function installLargePage(d,result){
  d.largeChats.set(d.large.index,{messages:d.messages,questionDraft:d.questionDraft,chatHistoryOpen:d.chatHistoryOpen});
  const previous=d._model;d.subscription?.dispose();d.subscription=null;if(d===current())editor.setModel(null);previous?.dispose();d._model=null;
  Object.assign(d,result);d.initialText=result.text;d.stagedText=result.text;d.savedText=result.text;d.view=null;d.review=null;d.lastReviewedVersion=null;
  const chat=d.largeChats.get(d.large.index);d.messages=chat?.messages||[];d.questionDraft=chat?.questionDraft||'';d.chatHistoryOpen=!!chat?.chatHistoryOpen;
  if(d===current()){editor.setModel(d.model);editor.setPosition({lineNumber:1,column:1});$('question').value=d.questionDraft;updateStatus();renderAI();}
  renderTabs();renderLarge();persist();
}
async function goLarge(index,encoding){
  const d=current();if(!d?.large||largeWorking)return;
  index=Math.max(0,Math.min(d.large.count-1,index));
  await largeOperation(d,async()=>{
    await flushLarge(d);
    const input={id:d.large.id,index,encoding};
    const result=await call(encoding?api.largeEncoding(input):api.largePage(input));installLargePage(d,result);
  });
}
function renderLarge(){
  const d=current(),l=d?.large;$('large-toolbar').hidden=!l;
  if(!l)return;
  $('large-size').textContent=`大文件 · ${(l.bytes/1048576).toLocaleString('zh-CN',{maximumFractionDigits:2})} MiB`;
  $('large-index').value=l.index+1;$('large-index').max=l.count;$('large-total').textContent='/ '+l.count+' 段';
  $('large-range').max=l.count;$('large-range').value=l.index+1;$('large-encoding').value=d.encoding;
  $('large-state').textContent=largeWorking?'正在处理，请稍候…':'可编辑 · 行号、查找、全选和 AI 仅限本片段 · 切段后撤销记录重置';
  for(const id of ['large-prev','large-next','large-go','large-index','large-range','large-encoding'])$(id).disabled=largeWorking;
  $('large-prev').disabled=largeWorking||l.index===0;$('large-next').disabled=largeWorking||l.index===l.count-1;
}
$('large-prev').onclick=action(()=>goLarge(current().large.index-1));
$('large-next').onclick=action(()=>goLarge(current().large.index+1));
$('large-go').onclick=action(()=>goLarge(Number($('large-index').value)-1));
$('large-index').onkeydown=event=>{if(event.key==='Enter')$('large-go').click();};
$('large-range').onchange=action(event=>goLarge(Number(event.target.value)-1));
$('large-encoding').onchange=action(async event=>{try{await goLarge(current().large.index,event.target.value);}finally{renderLarge();}});
function createDoc(input={}) {
  const name=input.path?input.name||input.path.split(/[\\/]/).pop():draftTitle(input.text||'');
  const id=input.id||crypto.randomUUID(),language=input.language||extLanguage(name);
  const d={id,name,path:input.path||null,language,large:input.large||null,largeChats:new Map(input.largeChats||[]),stagedText:input.text||'',initialText:input.text||'',_model:null,savedText:input.savedText??input.text??'',encoding:input.encoding||'utf8',bom:!!input.bom,fingerprint:input.fingerprint||'',view:null,review:null,messages:input.messages||[],chatHistoryOpen:!!input.chatHistoryOpen,questionDraft:input.questionDraft||'',lastReviewedVersion:null};
  // Restored background tabs stay as plain text until first selected. Persistence
  // and dirty indicators must not instantiate them as a side effect.
  Object.defineProperty(d,'model',{get(){
    if(d._model)return d._model;
    const model=d._model=monaco.editor.createModel(d.initialText,d.language,monaco.Uri.parse('inmemory://document/'+encodeURIComponent(id)+'/'+encodeURIComponent(name)));
    d.initialText=null;
    if(d.large)d.stagedText=model.getValue();
    d.subscription=model.onDidChangeContent(()=>{
    if(!d.path)d.name=draftTitle(d.model.getLineContent(1));
    if(d.id===active){updateStatus();renderReview();scheduleAuto();}
    if(d.id===active)features?.onEdit();
    renderTabs();if(readyForPersistence)persist();
    });
    return model;
  }});
  docs.push(d);return d;
}
function draftTitle(text){return Array.from(text.split(/\r?\n/,1)[0].replace(/[\u0000-\u001f]/g,' ').trim()).slice(0,120).join('')||'无标题';}
function activate(id){
  if(largeWorking){toast('大文件正在处理，稍等一下。');return;}
  if(!$('preferences-page').hidden)closePreferences();
  if(id===active){editor.focus();return;}
  const previous=current();if(previous)previous.view=editor.saveViewState();
  if(busy)cancelRequest();
  clearTimeout(autoTimer);active=id;
  const d=current();if(!d)return;
  editor.setModel(d.model);if(d.view)editor.restoreViewState(d.view);
  $('question').value=d.questionDraft;
  $('language').value=d.language;renderLarge();renderTabs();revealActiveTab();updateStatus();renderAI();if(readyForPersistence)persist();scheduleAuto();editor.focus();
  features?.onActivate();
}
function renderTabs(){
  const offset=$('tabs').scrollLeft;
  $('tabs').replaceChildren();
  for(const d of docs){
    const tab=document.createElement('div');tab.className='tab'+(d.id===active?' active':'');tab.role='tab';tab.tabIndex=d.id===active?0:-1;tab.setAttribute('aria-selected',d.id===active?'true':'false');tab.dataset.id=d.id;tab.title=d.path||d.name;
    const label=document.createElement('span');label.className='tab-name';label.textContent=d.name;
    const close=document.createElement('button');close.className='tab-close'+(dirty(d)?' dirty':'');close.title=dirty(d)?'有未保存的修改 · 关闭':'关闭标签页';close.setAttribute('aria-label','关闭 '+d.name);close.innerHTML=icons.close;
    close.addEventListener('click',action(async event=>{event.stopPropagation();await closeDoc(d.id);}));
    tab.draggable=true;
    tab.addEventListener('dragstart',event=>{if(largeWorking){event.preventDefault();return;}draggedTab=d.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-jianwen-tab',d.id);const token=crypto.randomUUID();event.dataTransfer.setData('application/x-jianwen-transfer',token);event.dataTransfer.setData('application/x-jianwen-window',windowSessionId);features?.prepare(d,token).catch(e=>toast(e.message));tab.classList.add('dragging');});
    tab.addEventListener('dragend',()=>{draggedTab=null;tab.classList.remove('dragging');});
    tab.addEventListener('dragover',event=>{if(!draggedTab&&!event.dataTransfer.types.includes('application/x-jianwen-transfer'))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';const bounds=$('tabs').getBoundingClientRect();if(event.clientX<bounds.left+28)$('tabs').scrollLeft-=24;else if(event.clientX>bounds.right-28)$('tabs').scrollLeft+=24;});
    tab.addEventListener('drop',event=>{if(!draggedTab)return;event.preventDefault();event.stopPropagation();moveTab(draggedTab,d.id);draggedTab=null;});
    tab.append(label,close);tab.addEventListener('click',()=>activate(d.id));tab.addEventListener('keydown',event=>{if(event.key==='Enter')activate(d.id);if(event.altKey&&event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const i=docs.indexOf(d),target=docs[i+(event.key==='ArrowLeft'?-1:1)];if(target)moveTab(d.id,target.id);}});$('tabs').append(tab);
  }
  $('tabs').scrollLeft=offset;updateTabScroll();
}
let draggedTab=null;
function moveTab(id,targetId){
  if(largeWorking||id===targetId)return;
  const from=docs.findIndex(d=>d.id===id),to=docs.findIndex(d=>d.id===targetId);
  if(from<0||to<0)return;
  const [doc]=docs.splice(from,1);docs.splice(to,0,doc);
  renderTabs();revealActiveTab();if(readyForPersistence)persist();
}
function updateTabScroll(){
  const tabs=$('tabs');
  // Include the space the arrows will release without briefly expanding the
  // viewport: expanding it would clamp scrollLeft and move the last tab.
  const released=$('tabs-back').hidden?0:$('tabs-back').offsetWidth+$('tabs-forward').offsetWidth+8;
  const overflow=tabs.scrollWidth>tabs.clientWidth+released+1;
  $('tabs-back').hidden=$('tabs-forward').hidden=!overflow;
  $('tabs-back').disabled=tabs.scrollLeft<=1;
  $('tabs-forward').disabled=tabs.scrollLeft+tabs.clientWidth>=tabs.scrollWidth-1;
}
function revealActiveTab(){
  const tab=$('tabs').querySelector('.tab.active');if(!tab)return;
  const tabs=$('tabs'),area=tabs.getBoundingClientRect(),item=tab.getBoundingClientRect();
  if(tab===tabs.lastElementChild)tabs.scrollLeft=tabs.scrollWidth;
  else if(tab===tabs.firstElementChild)tabs.scrollLeft=0;
  else if(item.left<area.left)tabs.scrollLeft-=area.left-item.left;
  else if(item.right>area.right)tabs.scrollLeft+=item.right-area.right;
  updateTabScroll();
}
for(const [id,direction] of [['tabs-back',-1],['tabs-forward',1]])$(id).onclick=()=>{$('tabs').scrollBy({left:direction*Math.max(128,$('tabs').clientWidth*.7),behavior:'smooth'});};
$('tabs').addEventListener('scroll',()=>{const tabs=$('tabs');$('tabs-back').disabled=tabs.scrollLeft<=1;$('tabs-forward').disabled=tabs.scrollLeft+tabs.clientWidth>=tabs.scrollWidth-1;});
new ResizeObserver(()=>{updateTabScroll();revealActiveTab();}).observe(document.querySelector('.titlebar'));
function updateStatus(){const d=current();if(!d)return;const pos=editor.getPosition()||{lineNumber:1,column:1};
  $('cursor').textContent=`${d.large?'片段内 · ':''}行 ${pos.lineNumber}，列 ${pos.column}`;
  $('count').textContent=d.model.getValueLength().toLocaleString()+(d.large?' 个字符（本段）':' 个字符');
  $('line-ending').textContent=d.model.getEOL()==='\r\n'?'Windows (CRLF)':'Unix (LF)';
  $('file-state').textContent=d.path?(dirty(d)?'尚未保存修改':'已保存'):'未保存';$('file-state').title=d.path||'新建文本';
  $('encoding').textContent=({utf8:'UTF-8','utf16-le':'UTF-16 LE','utf16-be':'UTF-16 BE',gb18030:'GB18030',latin1:'单字节（无损）'}[d.encoding]||d.encoding)+(d.bom?' BOM':'');
  $('placeholder').hidden=d.model.getValueLength()>0;
  document.title=(dirty(d)?'● ':'')+d.name+' — 简文';
}
async function openFiles(result){if(result.error)throw new Error(result.error);let target;const warnings=[];for(const file of result.files||[]){const existing=docs.find(d=>d.path?.toLowerCase()===file.path.toLowerCase());target=existing?.id||createDoc(file).id;if(file.encoding==='latin1')warnings.push(file.name+'：含混合或损坏的编码字节，已按单字节无损读取；非英文可能显示异常。');}if(target)activate(target);if(result.errors?.length||warnings.length)toast([...(result.errors||[]),...warnings].join('；'));}
async function saveDoc(d,saveAs=false){
  if(largeWorking){toast('大文件正在处理，稍等一下。');return false;}
  if(d.large)return largeOperation(d,async()=>{
    await flushLarge(d);
    const result=await call(api.largeSave({id:d.large.id,index:d.large.index,saveAs,...d.saveEncoding}));
    if(result.canceled)return false;
    installLargePage(d,result);toast(result.warning||('已完整保存：'+d.name));return true;
  });
  const text=d.model.getValue(),name=d.path?d.name:(d.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'')||'无标题')+'.txt';
  const result=await call(api.save({path:d.path,name,text,fingerprint:d.fingerprint,saveAs,...d.saveEncoding}));
  if(result.canceled)return false;
  Object.assign(d,result);d.savedText=text;renderTabs();updateStatus();persist();toast('已保存：'+d.name);return true;
}
async function closeDoc(id,transferred=false){
  const d=docs.find(x=>x.id===id);if(!d||largeWorking)return;
  let discarded=false;if(!transferred&&dirty(d)){const r=await call(api.confirmClose(d.name));if(r.action==='cancel')return;if(r.action==='save'&&!await saveDoc(d))return;discarded=r.action==='discard';}
  if(!transferred)features?.remember(d,discarded);
  if(d.large)await largeQueue(()=>call(api.largeRelease({id:d.large.id,discard:dirty(d)})));
  const index=docs.indexOf(d);docs.splice(index,1);d.subscription?.dispose();
  if(active===id){if(!docs.length)createDoc();active=null;activate(docs[Math.min(index,docs.length-1)].id);}
  d._model?.dispose();renderTabs();if(readyForPersistence)persist();
}
function renderAI(){const d=current();if(!d)return;$('context-name').textContent=d.name+(d.large?` · 第 ${d.large.index+1} 段`:'');$('context-name').title=(d.large?'只读取当前片段，无法读取整份大文件：':'只读取当前标签页：')+d.name;
  document.querySelector('.context-note').textContent=d.large?'AI 仅能读写本片段 · 不代表整份文件 · Ctrl+Z 撤销':'AI 可直接写入当前页 · Ctrl+Z 撤销';
  $('auto-review').disabled=!!d.large;$('auto-review').parentElement.title=d.large?'大文件请手动检查当前片段；自动提醒已暂停':'停止输入后自动检查';
  $('review').textContent=d.large?'检查当前片段':'检查当前文本';
  $('ai-name-label').textContent=settings.assistantName||'AI 助手';$('ai-toggle-name').textContent=settings.assistantName||'AI 助手';
  $('connection-dot').classList.toggle('connected',!!settings.hasKey);$('auto-review').checked=!!settings.autoReview&&!d.large;
  $('ai-state').textContent=busy?'正在阅读当前文本…':settings.hasKey?settings.model:'先配置你的模型，就可以开始了';
  renderReview();renderChat();updateBusy();
}
function blankState(){
  const box=document.createElement('div');box.className='ai-empty';box.innerHTML='<div class="ai-welcome-icon">'+icons.spark+'</div><h3>一起把文字写好</h3><p>写一段内容，整理一条命令，<br>或者聊聊当前这页文本。</p>';
  if(!settings.hasKey){const b=document.createElement('button');b.className='text-link';b.textContent='连接自己的 AI →';b.onclick=showSettings;box.append(b);}return box;
}
function renderReview(){
  const d=current();if(!d)return;const root=$('review-results');root.replaceChildren();
  if(!d.review){if(!d.messages.length)root.append(blankState());return;}
  const stale=d.review.version!==d.model.getAlternativeVersionId();
  const summary=document.createElement('div');summary.className='review-summary';const heading=document.createElement('span');heading.className='section-label';heading.textContent='文本检查';const text=document.createElement('p');text.textContent=d.review.summary;summary.append(heading,text);root.append(summary);
  if(stale){const note=document.createElement('div');note.className='stale-note';note.textContent='文本已变化，重新检查后再应用建议。';root.append(note);}
  for(const issue of d.review.issues){
    const card=document.createElement('article');card.className='issue '+issue.severity;
    const line=document.createElement('button');line.className='line-link';line.textContent='第 '+issue.line+' 行';line.onclick=()=>{editor.revealLineInCenter(issue.line);editor.setPosition({lineNumber:issue.line,column:1});editor.focus();};
    const title=document.createElement('h4');title.textContent=issue.title;const message=document.createElement('p');message.textContent=issue.message;card.append(line,title,message);
    if(issue.original&&typeof issue.replacement==='string'){
      const details=document.createElement('details');const label=document.createElement('summary');label.textContent='查看修改建议';
      const old=document.createElement('pre');old.className='before';old.textContent='− '+issue.original;const next=document.createElement('pre');next.className='after';next.textContent='+ '+issue.replacement;
      const apply=document.createElement('button');apply.className='apply-fix';apply.textContent='应用这处修改';apply.disabled=stale;apply.onclick=()=>applyFix(d,issue);details.append(label,old,next,apply);card.append(details);
    }
    root.append(card);
  }
  monaco.editor.setModelMarkers(d.model,'ai',stale?[]:d.review.issues.map(x=>({startLineNumber:x.line,startColumn:1,endLineNumber:x.line,endColumn:d.model.getLineMaxColumn(x.line),message:x.title+'：'+x.message,severity:x.severity==='error'?monaco.MarkerSeverity.Error:x.severity==='info'?monaco.MarkerSeverity.Info:monaco.MarkerSeverity.Warning})));
}
function applyFix(d,issue){
  if(d!==current()||d.review.version!==d.model.getAlternativeVersionId()){toast('文本已经变化，请重新检查。');return;}
  const text=d.model.getValue(),lineStart=d.model.getOffsetAt({lineNumber:issue.line,column:1}),index=text.indexOf(issue.original,lineStart);
  const lineEnd=d.model.getOffsetAt({lineNumber:issue.line,column:d.model.getLineMaxColumn(issue.line)});
  if(index<lineStart||index>lineEnd){toast('找不到完全一致的原文，未作修改。');return;}
  const start=d.model.getPositionAt(index),end=d.model.getPositionAt(index+issue.original.length);
  editor.pushUndoStop();editor.executeEdits('ai-fix',[{range:new monaco.Range(start.lineNumber,start.column,end.lineNumber,end.column),text:issue.replacement,forceMoveMarkers:true}]);editor.pushUndoStop();editor.focus();toast('已应用，可按 Ctrl+Z 撤销。');
}
function renderChat(){
  renderConversation($('chat'),current(),{name:settings.assistantName||'AI 助手',spark:icons.spark,onError:toast});
  $('clear-chat').disabled=!current()?.messages.length;
  updateChatPending();
}
async function clearChat(){
  const d=current();if(!d)return;
  const token=busy?.docId===d.id&&busy.mode==='chat'?busy:null;
  if(token)token.canceled=true;
  d.messages=[];d.chatHistoryOpen=false;
  renderAI();toast('已清空当前页对话，后续提问从新对话开始。');
  if(token){try{await api.cancel();}finally{if(busy===token){busy=null;updateBusy();}}}
}
const waitingPhrases=['摸鱼中…','让我琢磨一下…','正在捋思路…','文字小工开工了…','答案正在路上…','稍等，灵感正在排队…'];
function waitingDetail(){
  if(!busy)return '';
  const seconds=Math.max(0,Math.floor((Date.now()-busy.startedAt)/1000));
  const turn=Math.floor(seconds/4);
  if(busy.waitTurn!==turn){
    const choices=waitingPhrases.filter(text=>text!==busy.waitPhrase);
    busy.waitPhrase=choices[Math.floor(Math.random()*choices.length)];busy.waitTurn=turn;
  }
  return (busy.mode==='review'?'检查文章 · ':'')+busy.waitPhrase+' · 已等待 '+seconds+' 秒';
}
function updateChatPending(){
  const d=current(),visible=!!busy&&!busy.canceled&&busy.docId===d?.id,name=settings.assistantName||'AI 助手',detail=waitingDetail();
  showPending($('chat'),visible&&busy.mode==='chat'&&d.messages.at(-1)?.role==='user',name,detail);
  showPending($('review-pending'),visible&&busy.mode==='review',name,detail);
}
function refreshWaiting(){if(!busy||busy.canceled)return;updateChatPending();$('ai-state').textContent=waitingDetail();}
function updateBusy(){
  const working=!!busy&&!busy.canceled;
  $('review').disabled=!!busy;$('send').innerHTML=working?'■':icons.arrow;$('send').title=working?'停止请求':'发送 · Ctrl+Enter';$('send').setAttribute('aria-label',working?'停止回复':'发送消息');$('send').classList.toggle('working',working);
  $('ai-state').textContent=working?waitingDetail():settings.hasKey?settings.model:'先配置你的模型，就可以开始了';
  clearInterval(waitTicker);waitTicker=working?setInterval(refreshWaiting,1000):null;updateChatPending();
}
async function cancelRequest(){if(!busy)return;const previous=busy;busy=null;previous.canceled=true;await api.cancel();updateBusy();}
async function requestAI(mode,automatic=false){
  const d=current();if(!d)return;
  if(!settings.hasKey){if(!automatic)showSettings();return;}
  if(busy||largeWorking)return;
  const text=d.model.getValue();if(mode==='review'&&!text.trim()){if(!automatic)toast('先输入需要检查的文本。');return;}
  const question=$('question').value.trim();if(mode==='chat'&&!question)return;
  const token={docId:d.id,segment:d.large?.index,version:d.model.getAlternativeVersionId(),mode,canceled:false,startedAt:Date.now()};busy=token;
  const history=d.messages.slice(-8);
  if(mode==='chat'){d.messages.push({role:'user',content:question});d.questionDraft='';d.chatHistoryOpen=false;$('question').value='';renderReview();renderChat();$('ai-scroll').scrollTop=$('ai-scroll').scrollHeight;}
  updateBusy();if(automatic)lastAutoAt=Date.now();
  try {
    const result=await call(api.ask({mode,text,name:d.name+(d.large?`（仅第 ${d.large.index+1}/${d.large.count} 片段）`:''),partial:!!d.large,language:d.language,question,history}));
    if(token.canceled||result.canceled||!docs.includes(d)||token.segment!==d.large?.index)return;
    if(mode==='review'){
      d.review={...result,version:token.version};d.lastReviewedVersion=token.version;
      if(d.id===active)renderReview();
    } else {
      if(typeof result.replacement==='string'){
        if(d!==current()||token.version!==d.model.getAlternativeVersionId()){
          d.messages.push({role:'assistant',content:'生成期间文本或标签页已变化，未覆盖。生成内容如下：\n'+result.replacement});
          if(d===current()){renderChat();toast('文本已变化，AI 生成内容保留在对话中。');}
          return;
        }
        editor.pushUndoStop();editor.executeEdits('ai-write',[{range:d.model.getFullModelRange(),text:result.replacement,forceMoveMarkers:true}]);editor.pushUndoStop();
        token.version=d.model.getAlternativeVersionId();toast('AI 已写入当前页，可按 Ctrl+Z 撤销。');
      }
      d.messages.push({role:'assistant',content:result.text+(token.version!==d.model.getAlternativeVersionId()?'\n\n（这条回复针对你提问时的文本。）':'')});
      if(d.id===active){renderChat();$('ai-scroll').scrollTop=$('ai-scroll').scrollHeight;}
    }
  } catch(e){if(!token.canceled){if(automatic)$('ai-state').textContent='自动检查未完成：'+e.message;else toast(e.message);}}
  finally{if(busy===token){busy=null;updateBusy();}if(settings.autoReview)scheduleAuto();}
}
function scheduleAuto(){
  clearTimeout(autoTimer);const d=current();
  if(!d||d.large||!settings.autoReview||!settings.hasKey||!d.model.getValue().trim()||d.model.getValueLength()>120000||d.lastReviewedVersion===d.model.getAlternativeVersionId())return;
  autoTimer=setTimeout(()=>{if(busy){scheduleAuto();return;}requestAI('review',true);},Math.max(8000,45000-(Date.now()-lastAutoAt)));
}
function showSettings(){
  $('assistant-name').value=settings.assistantName||'AI 助手';$('reasoning-effort').value=settings.reasoningEffort||'';
  $('base-url').value=settings.baseUrl||'';$('model').value=settings.model||'';$('api-key').value='';$('api-key').placeholder=settings.hasKey?'已保存密钥，留空即可保留':'请输入 API Key';$('settings-status').textContent='';$('settings-dialog').showModal();
}
function settingInput(){return {baseUrl:$('base-url').value.trim(),model:$('model').value.trim(),apiKey:$('api-key').value.trim(),assistantName:$('assistant-name').value.trim(),reasoningEffort:$('reasoning-effort').value,autoReview:!!settings.autoReview};}
async function configureAuto(event){
  if(!settings.hasKey){event.target.checked=false;showSettings();return;}
  settings=await call(api.saveSettings({...settings,autoReview:event.target.checked}));renderAI();scheduleAuto();
}

$('new').onclick=$('tab-new').onclick=()=>activate(createDoc().id);
$('open').onclick=action(async()=>openFiles(await call(api.open())));
$('save').onclick=action(()=>saveDoc(current()));$('save-as').onclick=action(()=>saveDoc(current(),true));
$('find').onclick=()=>editor.getAction('actions.find').run();
$('replace').onclick=()=>editor.getAction('editor.action.startFindReplaceAction').run();
$('go-line').onclick=()=>{const count=current()?.model.getLineCount();if(!count)return;$('go-line-number').max=count;$('go-line-number').value=editor.getPosition().lineNumber;$('go-line-hint').textContent=`${current().large?'当前片段：':''}1 至 ${count} 行`;$('go-line-dialog').showModal();$('go-line-number').select();};
$('go-line-cancel').onclick=()=>{$('go-line-dialog').close();editor.focus();};
$('go-line-form').onsubmit=event=>{event.preventDefault();const n=Number($('go-line-number').value);if(!Number.isInteger(n)||n<1||n>current().model.getLineCount())return;editor.setPosition({lineNumber:n,column:1});editor.revealLineInCenter(n);$('go-line-dialog').close();editor.focus();};
$('insert-time').onclick=()=>{if(largeWorking||closing)return;const now=new Date();editor.focus();editor.pushUndoStop();editor.executeEdits('insert-time',[{range:editor.getSelection(),text:now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' '+now.toLocaleDateString(),forceMoveMarkers:true}]);editor.pushUndoStop();};
$('menu-status').onclick=()=>{appearance.statusBar=appearance.statusBar===false;applyAppearance();persist();};
$('print').onclick=action(async()=>{const d=current();if(!d)return;const print=async()=>{if(d.large)await flushLarge(d);await call(api.print({id:d.large?.id,text:d.large?'':d.model.getValue(),name:d.name,fontFamily:appearance.fontFamily,fontSize:appearance.fontSize}));};if(d.large)await largeOperation(d,print);else await print();});
$('close-tab').onclick=action(()=>closeDoc(active));
for(const [id,command] of [['undo','undo'],['redo','redo'],['cut','editor.action.clipboardCutAction'],['copy','editor.action.clipboardCopyAction'],['paste','editor.action.clipboardPasteAction'],['select-all','editor.action.selectAll']])$(id).onclick=()=>{editor.focus();editor.trigger('menu',command);};
$('wrap').onclick=$('menu-wrap').onclick=$('wrap-setting').onchange=()=>{appearance.wrap=!appearance.wrap;applyAppearance();persist();};
$('language').onchange=event=>{const d=current();d.language=event.target.value;monaco.editor.setModelLanguage(d.model,d.language);features?.onEdit();persist();};
$('font-family').onchange=event=>{appearance.fontFamily=event.target.value;applyAppearance();persist();};
$('font-style').onchange=event=>{appearance.fontStyle=event.target.value;applyAppearance();persist();};
function setZoom(value){appearance.zoom=Math.max(50,Math.min(300,value));applyAppearance();persist();}
$('zoom').onclick=()=>setZoom(100);
$('editor').addEventListener('wheel',event=>{if(!event.ctrlKey||!event.deltaY)return;event.preventDefault();event.stopImmediatePropagation();setZoom(appearance.zoom+(event.deltaY<0?10:-10));},{passive:false,capture:true});
$('font-size').onchange=event=>{appearance.fontSize=normalizeFontSize(Number(event.target.value)||10);applyAppearance();persist();};
$('line-numbers').onchange=event=>{appearance.lineNumbers=event.target.checked;applyAppearance();persist();};
$('menu-lines').onclick=()=>{appearance.lineNumbers=!appearance.lineNumbers;applyAppearance();persist();};
const showPreferences=()=>{$('preferences-page').hidden=false;$('layout').hidden=true;$('app').classList.add('preferences-open');api.windowSurface?.('settings');$('preferences-close').focus();ensureFonts();};
function closePreferences(){$('preferences-page').hidden=true;$('layout').hidden=false;$('app').classList.remove('preferences-open');api.windowSurface?.('editor');applyPanelSize();editor.layout();editor.focus();}
$('preferences').onclick=$('font-settings').onclick=showPreferences;
$('preferences-close').onclick=closePreferences;
$('ai-preferences').onclick=showSettings;
for(const id of ['theme-light','theme-dark'])$(id).onclick=()=>{appearance.theme=id==='theme-dark'?'dark':'light';applyAppearance();persist();};
$('theme').onchange=event=>{appearance.theme=event.target.value;applyAppearance();persist();};
$('ai-width').onchange=event=>{appearance.aiWidth=Math.max(280,Math.min(900,Math.round(Number(event.target.value)||360)));applyPanelSize();persist();};
$('input-height').onchange=event=>{appearance.inputHeight=Math.max(80,Math.min(420,Math.round(Number(event.target.value)||120)));applyPanelSize();persist();};
$('toggle-ai').onclick=()=>setAIVisible($('layout').classList.contains('ai-hidden'));$('hide-ai').onclick=()=>setAIVisible(false);
$('settings').onclick=showSettings;$('settings-close').onclick=()=>$('settings-dialog').close();
$('auto-review').onchange=action(configureAuto);
$('review').onclick=action(()=>requestAI('review'));
$('clear-chat').onclick=action(clearChat);
$('send').onclick=action(()=>busy?cancelRequest():requestAI('chat'));
$('question').oninput=()=>{const d=current();if(d)d.questionDraft=$('question').value;};
$('question').onkeydown=event=>{if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();action(()=>requestAI('chat'))();}};
$('settings-form').onsubmit=async event=>{event.preventDefault();$('settings-save').disabled=true;try{settings=await call(api.saveSettings(settingInput()));$('api-key').value='';$('settings-dialog').close();renderAI();scheduleAuto();toast('AI 设置已保存。');}catch(e){$('settings-status').textContent=e.message;}finally{$('settings-save').disabled=false;}};
$('test-connection').onclick=async()=>{$('test-connection').disabled=true;$('settings-status').textContent='正在测试…';try{await call(api.testConnection(settingInput()));$('settings-status').textContent='连接成功，可以保存并开始使用。';}catch(e){$('settings-status').textContent=e.message;}finally{$('test-connection').disabled=false;}};
editor.onDidChangeCursorPosition(updateStatus);
document.addEventListener('keydown',event=>{
  if($('go-line-dialog').open)return;
  if($('settings-dialog').open)return;
  if(!$('preferences-page').hidden){if(event.key==='Escape'){event.preventDefault();closePreferences();}return;}
  const editing=event.target.closest('#editor,#rtl-editor');
  if(editing&&event.key==='F5'){event.preventDefault();$('insert-time').click();return;}
  if(editing&&event.ctrlKey&&!event.altKey&&['g','p'].includes(event.key.toLowerCase())){event.preventDefault();$(event.key.toLowerCase()==='g'?'go-line':'print').click();return;}
  if(event.ctrlKey&&!event.altKey){
    const key=event.key.toLowerCase();
    if(editing&&['+','=','-','_'].includes(key)){event.preventDefault();event.stopPropagation();setZoom(appearance.zoom+(['-','_'].includes(key)?-10:10));return;}
    if(event.shiftKey&&['n','t','m'].includes(key))return;
    if(key==='0'&&!event.shiftKey&&event.target!==$('question')){event.preventDefault();event.stopPropagation();setZoom(100);}
    if(['s','o','n','w'].includes(key)){event.preventDefault();event.stopPropagation();if(key==='s')action(()=>saveDoc(current(),event.shiftKey))();if(key==='o')$('open').click();if(key==='n')$('new').click();if(key==='w')action(()=>closeDoc(active))();}
    if(event.key==='Tab'){event.preventDefault();const i=docs.findIndex(d=>d.id===active);activate(docs[(i+(event.shiftKey?-1:1)+docs.length)%docs.length].id);}
  }
},true);
window.addEventListener('dragover',event=>event.preventDefault());
window.addEventListener('drop',event=>{event.preventDefault();if(event.dataTransfer.files.length)action(async()=>openFiles(await call(api.dropped(event.dataTransfer.files))))();});
api.onOpen(result=>action(()=>openFiles(result))());
api.onSettings?.(value=>{settings=value;renderAI();scheduleAuto();});
let closing=false;
api.onClose(async()=>{if(closing)return;closing=true;editor.updateOptions({readOnly:true});clearTimeout(persistTimer);try{if(busy)await cancelRequest();await persistSnapshot(true);}catch(e){closing=false;editor.updateOptions({readOnly:false});toast('关闭前保存恢复记录失败：'+e.message);}});
if(window.__jianwenTrace)api.startupTrace('features-before');
features=installFeatures({editor,monaco,api,current,docs,activate,createDoc,openFiles,saveDoc,closeDoc,persist,toast,flushLarge,largeOperation,readOnly:()=>largeWorking||closing,appearance:()=>appearance,applyAppearance,windowId:()=>windowSessionId,persistNow:()=>persistSnapshot(false),askAI:question=>{setAIVisible(true);$('question').value=question;current().questionDraft=question;$('question').focus();}});
installClipboard(editor,monaco,toast);
if(window.__jianwenTrace)api.startupTrace('features-after');

async function boot(){
  if(window.__jianwenTrace)api.startupTrace('editor-created');
  const state=await call(globalThis.jianwenBoot||api.boot());delete globalThis.jianwenBoot;delete globalThis.jianwenBootState;settings=state.settings;
  windowSessionId=state.windowId||'';
  $('settings-version').textContent=state.version;
  appearance=restoreAppearance(state.session.appearance);applyAppearance();
  for(const d of state.session.docs||[])createDoc(d);
  if(!docs.length)createDoc();
  setAIVisible(state.session.aiVisible===true);
  if(!state.opened?.files?.length)activate(docs.find(d=>d.id===state.session.active)?.id||docs[0].id);
  await openFiles(state.opened);renderAI();
  // Signal readiness only once the text has had a chance to paint. All event
  // handlers above are installed before native queued files are released.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  readyForPersistence=true;
document.documentElement.dataset.editorReady='true';
  await api.uiReady?.();
  if(window.__jianwenTrace)api.startupTrace('editor-painted');
}
boot().catch(e=>toast('启动失败：'+e.message));
