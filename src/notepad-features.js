// Optional features stay outside the text editor's startup-critical rendering path.
export function installFeatures(ctx){
 const {editor,monaco,api,current,docs,activate,createDoc,openFiles,saveDoc,closeDoc,persist,toast,flushLarge}=ctx;
 const $=id=>document.getElementById(id),appearance=()=>ctx.appearance();
 const button=(menu,id,text,key='')=>{const b=document.createElement('button');b.id=id;b.role='menuitem';const label=document.createElement('span');label.textContent=text;b.append(label);if(key){const k=document.createElement('kbd');k.textContent=key;b.append(k);}$(menu).append(b);return b;};
 const run=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>toast(e.message));
 const call=async p=>{const r=await p;if(r?.error)throw Error(r.error);return r;};
 const history=[],prepared=new Map();let previewModule,spellTimer,spellGeneration=0,spellIssues=[],spellDecorations=editor.createDecorationsCollection(),formatBar;
 const ignored=new Set(),personal=new Set();let personalLoaded;
 async function loadPersonal(){personalLoaded??=call(api.spellWords()).then(result=>{for(const word of result.words||[])personal.add(word.toLowerCase());});await personalLoaded;}
 const pane=document.createElement('section');pane.id='markdown-preview';pane.hidden=true;pane.setAttribute('aria-label','Markdown 排版预览');$('editor-shell').after(pane);
 const tool=document.createElement('div');tool.id='format-toolbar';tool.hidden=true;
 const wrap=(before,after=before)=>{const d=current();if(!d||ctx.readOnly())return;const selection=editor.getSelection(),text=d.model.getValueInRange(selection);editor.focus();editor.pushUndoStop();editor.executeEdits('markdown-format',[{range:selection,text:before+text+after,forceMoveMarkers:true}]);editor.pushUndoStop();};
 for(const [label,before,after] of [['标题','# ',''],['加粗','**','**'],['斜体','*','*'],['链接','[','](https://)'],['列表','- ',''],['任务','- [ ] ',''],['引用','> ',''],['代码','`','`']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>wrap(before,after);tool.append(b);}
 document.querySelector('.document-area').prepend(tool);formatBar=tool;
 const rtl=document.createElement('textarea');rtl.id='rtl-editor';rtl.dir='rtl';rtl.hidden=true;rtl.spellcheck=false;rtl.setAttribute('aria-label','从右到左文本编辑区');$('editor-shell').append(rtl);let syncingRtl=false;
 const rtlOffset=n=>rtl.value.slice(0,n).replace(/\n/g,current().model.getEOL()).length;
 const rtlSelection=()=>{const d=current();if(!d)return;const begin=d.model.getPositionAt(rtlOffset(rtl.selectionStart)),end=d.model.getPositionAt(rtlOffset(rtl.selectionEnd));editor.setSelection(new monaco.Range(begin.lineNumber,begin.column,end.lineNumber,end.column));};
 rtl.addEventListener('select',rtlSelection);rtl.addEventListener('keyup',rtlSelection);rtl.addEventListener('click',rtlSelection);
 rtl.addEventListener('input',()=>{const d=current();if(!d||ctx.readOnly())return;const before=d.model.getValue(),after=rtl.value.replace(/\n/g,d.model.getEOL());let start=0,end=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;while(end<before.length-start&&end<after.length-start&&before[before.length-1-end]===after[after.length-1-end])end++;const p=d.model.getPositionAt(start),q=d.model.getPositionAt(before.length-end);syncingRtl=true;try{editor.executeEdits('rtl-input',[{range:new monaco.Range(p.lineNumber,p.column,q.lineNumber,q.column),text:after.slice(start,after.length-end),forceMoveMarkers:true}]);rtlSelection();}finally{syncingRtl=false;}});
 rtl.addEventListener('keydown',event=>{if(!event.ctrlKey||event.altKey)return;const key=event.key.toLowerCase();if(['z','y'].includes(key)){event.preventDefault();editor.trigger('rtl',key==='y'||event.shiftKey?'redo':'undo');}else if(key==='f'||key==='h'){event.preventDefault();editor.getAction(key==='f'?'actions.find':'editor.action.startFindReplaceAction').run();}});
 editor.onDidChangeCursorSelection(()=>{if(!appearance().rtl||syncingRtl||!current())return;const selection=editor.getSelection(),model=current().model;const offset=position=>model.getValueInRange(new monaco.Range(1,1,position.lineNumber,position.column)).replace(/\r\n/g,'\n').length;rtl.setSelectionRange(offset(selection.getStartPosition()),offset(selection.getEndPosition()));});
 button('file-menu','new-window','新建窗口','Ctrl+Shift+N').onclick=run(()=>call(api.newWindow()));
 button('file-menu','move-window','将当前标签移至新窗口').onclick=run(async()=>{
  const token=crypto.randomUUID();await prepare(current(),token);await call(api.newWindow({transfer:token}));
 });
 button('file-menu','recent-files','最近文件…').onclick=run(async()=>{
  const {paths}=await call(api.recent());const dialog=$('recent-dialog'),list=$('recent-list');list.replaceChildren();
  if(!paths.length)list.textContent='还没有最近打开的文件。';
  for(const path of paths){const b=document.createElement('button');b.textContent=path;b.title=path;b.onclick=run(async()=>{await openFiles(await call(api.openPath(path)));dialog.close();});list.append(b);}dialog.showModal();
 });
 button('file-menu','reopen-tab','重新打开关闭的标签','Ctrl+Shift+T').onclick=run(async()=>{const d=history.pop();if(!d){toast('没有可恢复的已关闭标签。');return;}const existing=docs.find(x=>d.path&&x.path?.toLowerCase()===d.path.toLowerCase());if(existing)activate(existing.id);else if(d.large)await openFiles(await call(api.openPath(d.path)));else activate(createDoc(d).id);});
 button('file-menu','save-encoding','另存为并选择编码…').onclick=()=>{const d=current();if(!d)return;$('save-encoding-select').value=d.encoding==='latin1'?'utf8':d.encoding+(d.bom&&d.encoding==='utf8'?'-bom':'');$('save-encoding-dialog').showModal();};
 button('file-menu','page-setup','页面设置…').onclick=run(async()=>{const settings=await call(api.printSettings());$('print-header').value=settings.header??'&f';$('print-footer').value=settings.footer??'第 &p 页';$('page-setup-dialog').showModal();});
 button('file-menu','exit-all','退出所有窗口').onclick=run(()=>call(api.exitAll()));
 button('view-menu','markdown-mode','Markdown 排版预览','Ctrl+Shift+M').onclick=run(async()=>{appearance().markdownMode=!appearance().markdownMode;ctx.applyAppearance();persist();await refreshMarkdown();});
 button('view-menu','reading-direction','从右到左阅读').onclick=()=>{appearance().rtl=!appearance().rtl;ctx.applyAppearance();persist();};
 button('edit-menu','spelling-settings','拼写检查与自动更正…').onclick=run(async()=>{
  const state=await call(api.spellLanguages()),select=$('spell-language');select.replaceChildren();
  select.add(new Option('英语（内置离线词典）','en-US-offline'));
  for(const language of state.languages){const option=document.createElement('option');option.value=language;option.textContent=language+'（Windows）';select.append(option);}
  select.value=appearance().spellLanguage||'en-US-offline';if(!select.value&&select.options.length)select.selectedIndex=0;
  $('spell-enabled').checked=!!appearance().spellEnabled;$('autocorrect-enabled').checked=!!appearance().autoCorrect;
  $('spell-status').textContent='内置离线英文词典，也可选择 Windows 已安装的词典。仅检查可见文字，不上传文本，代码模式默认跳过。中文纠错可使用 AI 检查。';$('spell-dialog').showModal();
 });
 button('edit-menu','spelling-review','查看拼写建议').onclick=run(async()=>{await $('spelling-settings').onclick();showSpelling();});
 button('edit-menu','find-next','查找下一个','F3').onclick=()=>editor.getAction('editor.action.nextMatchFindAction').run();
 button('edit-menu','find-previous','查找上一个','Shift+F3').onclick=()=>editor.getAction('editor.action.previousMatchFindAction').run();
 button('edit-menu','delete-selection','删除','Del').onclick=()=>{editor.focus();editor.trigger('menu','deleteRight');};
 button('edit-menu','select-all-text','全选当前文本','Ctrl+A').onclick=()=>{editor.focus();editor.trigger('menu','editor.action.selectAll');};
 button('edit-menu','ai-rewrite','AI 改写选区…').onclick=()=>{const selected=current()?.model.getValueInRange(editor.getSelection());ctx.askAI('将当前文本'+(selected?'中以下部分':'')+'改写得更清晰，保留原意：\n'+(selected||''));};
 button('edit-menu','ai-summarize','AI 总结当前文本').onclick=()=>ctx.askAI('请总结当前文本的要点。');
 button('edit-menu','ai-shorten','AI 缩短当前文本').onclick=()=>ctx.askAI('请精简当前文本，保留重要信息，并直接写入当前页。');
 button('edit-menu','ai-tone','AI 调整语气…').onclick=()=>ctx.askAI('请把当前文本改写为更自然、专业的语气，保留原意，并直接写入当前页。');
 const dialogHtml=`<dialog id="recent-dialog"><h2>最近文件</h2><div id="recent-list"></div><div class="dialog-actions"><button id="recent-clear">清空记录</button><button data-close="recent-dialog">关闭</button></div></dialog>
 <dialog id="save-encoding-dialog"><h2>选择保存编码</h2><label>编码<select id="save-encoding-select"><option value="utf8">UTF-8</option><option value="utf8-bom">UTF-8 BOM</option><option value="utf16-le">UTF-16 LE</option><option value="utf16-be">UTF-16 BE</option><option value="gb18030">GB18030</option></select></label><p>另存为保留原文件。无法表示的字符会报错，不会静默丢失。</p><div class="dialog-actions"><button data-close="save-encoding-dialog">取消</button><button id="save-encoding-confirm">另存为…</button></div></dialog>
 <dialog id="page-setup-dialog"><h2>页面设置</h2><label>页眉<input id="print-header" maxlength="200"></label><label>页脚<input id="print-footer" maxlength="200"></label><p>&amp;f 文件名　&amp;p 页码　&amp;d 日期　&amp;t 时间。接下来可设置纸张、方向和页边距。</p><div class="dialog-actions"><button data-close="page-setup-dialog">取消</button><button id="page-setup-confirm">纸张与页边距…</button></div></dialog>
 <dialog id="spell-dialog"><h2>拼写检查</h2><label><input type="checkbox" id="spell-enabled">启用拼写检查</label><label>词典<select id="spell-language"></select></label><label><input type="checkbox" id="autocorrect-enabled">自动应用词典标记的更正</label><p id="spell-status"></p><div id="spell-results"></div><div class="dialog-actions"><button data-close="spell-dialog">关闭</button><button id="spell-save">保存设置</button></div></dialog>`;
 document.body.insertAdjacentHTML('beforeend',dialogHtml);
 for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
 $('recent-clear').onclick=run(async()=>{await call(api.recentClear());$('recent-list').textContent='记录已清空，文件不会删除。';});
 $('save-encoding-confirm').onclick=run(async()=>{const d=current();if(!d)return;const choice=$('save-encoding-select').value;d.saveEncoding={encoding:choice==='utf8-bom'?'utf8':choice,bom:choice==='utf8-bom'||choice.startsWith('utf16')};$('save-encoding-dialog').close();try{await saveDoc(d,true);}finally{delete d.saveEncoding;}});
 $('page-setup-confirm').onclick=run(async()=>{const header=$('print-header').value,footer=$('print-footer').value;$('page-setup-dialog').close();await call(api.pageSetup({header,footer}));});
 $('spell-save').onclick=()=>{appearance().spellEnabled=$('spell-enabled').checked;appearance().autoCorrect=$('autocorrect-enabled').checked;appearance().spellLanguage=$('spell-language').value;ctx.applyAppearance();persist();$('spell-dialog').close();scheduleSpell();};
 function showSpelling(){
  const box=$('spell-results');box.replaceChildren();if(!spellIssues.length)box.textContent='可见文本中没有待处理的拼写提醒。';
  for(const issue of spellIssues){const row=document.createElement('div');row.className='spell-row';const label=document.createElement('span');label.textContent=issue.word+' → ';row.append(label);
   for(const suggestion of issue.suggestions){const b=document.createElement('button');b.textContent=suggestion;b.onclick=()=>{const d=current();if(d?.id!==issue.docId||d.model.getValueInRange(issue.range)!==issue.word){toast('文字已变化，请重新检查。');return;}editor.pushUndoStop();editor.executeEdits('spelling',[{range:issue.range,text:suggestion,forceMoveMarkers:true}]);editor.pushUndoStop();row.remove();};row.append(b);}
   for(const [label,permanent] of [['忽略本次',false],['加入个人词典',true]]){const b=document.createElement('button');b.textContent=label;b.onclick=run(async()=>{if(permanent)await call(api.spellWordAdd(issue.word));(permanent?personal:ignored).add(issue.word.toLowerCase());row.remove();scheduleSpell();});row.append(b);}box.append(row);
  }if(!$('spell-dialog').open)$('spell-dialog').showModal();
 }
 async function checkSpell(){
  const d=current(),a=appearance();spellDecorations.clear();spellIssues=[];
  if(!d||!a.spellEnabled||!a.spellLanguage||!['plaintext','command-text','markdown'].includes(d.language))return;
  const generation=++spellGeneration,version=d.model.getVersionId(),visible=editor.getVisibleRanges()[0];if(!visible)return;
  const start=d.model.getOffsetAt({lineNumber:visible.startLineNumber,column:1}),end=d.model.getPositionAt(start+20000),text=d.model.getValueInRange(new monaco.Range(visible.startLineNumber,1,end.lineNumber,end.column));
  await loadPersonal();
  const result=await call(a.spellLanguage==='en-US-offline'?(await import('./spelling-offline.js')).checkEnglish(text):api.spellCheck({text,language:a.spellLanguage}));if(generation!==spellGeneration||current()!==d||d.model.getVersionId()!==version||!appearance().spellEnabled)return;
  const decorations=[];
  for(const issue of result.issues||[]){const begin=d.model.getPositionAt(start+issue.start),end=d.model.getPositionAt(start+issue.start+issue.length),range=new monaco.Range(begin.lineNumber,begin.column,end.lineNumber,end.column),word=d.model.getValueInRange(range);if(ignored.has(word.toLowerCase())||personal.has(word.toLowerCase()))continue;
   const record={...issue,range,word,docId:d.id};spellIssues.push(record);decorations.push({range,options:{inlineClassName:'spelling-underline',hoverMessage:{value:'拼写建议：'+issue.suggestions.join('、')+'（编辑 → 查看拼写建议）'}}});
  }
  spellDecorations.set(decorations);
  if(a.autoCorrect&&(editor.hasTextFocus()||document.activeElement===rtl)&&!ctx.readOnly()){
   const pos=editor.getPosition(),offset=d.model.getOffsetAt(pos),issue=spellIssues.find(i=>i.action===2&&i.replacement&&start+i.start+i.length===offset-1&&/\s/.test(d.model.getValue().charAt(offset-1)));
   if(issue){editor.pushUndoStop();editor.executeEdits('autocorrect',[{range:issue.range,text:issue.replacement,forceMoveMarkers:true}]);editor.pushUndoStop();}
  }
 }
 function scheduleSpell(){clearTimeout(spellTimer);spellGeneration++;if(appearance().spellEnabled)spellTimer=setTimeout(()=>checkSpell().catch(e=>{$('spell-status').textContent=e.message;}),650);else{spellDecorations.clear();spellIssues=[];}}
 async function refreshMarkdown(){
  const d=current(),enabled=appearance().markdownMode;pane.hidden=!enabled;formatBar.hidden=!enabled;document.querySelector('.document-area').classList.toggle('markdown-layout',!!enabled);$('markdown-mode').setAttribute('aria-checked',String(!!enabled));
  if(!enabled||!d)return;
  const id=d.id,version=d.model.getVersionId();pane.textContent='正在排版…';previewModule??=import('./markdown-preview.js');const module=await previewModule;
  if(current()?.id!==id||current().model.getVersionId()!==version||!appearance().markdownMode)return;
  module.renderMarkdown(pane,d.model.getValue(),{partial:!!d.large,api,path:d.path});
 }
 let previewTimer;
 function syncRtl(){if(!appearance().rtl||syncingRtl||!current())return;const value=current().model.getValue().replace(/\r\n/g,'\n');if(rtl.value!==value){const start=rtl.selectionStart;rtl.value=value;rtl.setSelectionRange(Math.min(start,value.length),Math.min(start,value.length));}rtl.style.fontFamily=appearance().fontFamily;rtl.style.fontSize=(appearance().fontSize*4/3*appearance().zoom/100)+'px';rtl.style.fontWeight=appearance().fontStyle.includes('Bold')?'700':'400';rtl.style.fontStyle=appearance().fontStyle.includes('Italic')?'italic':'normal';rtl.wrap=appearance().wrap?'soft':'off';rtl.readOnly=ctx.readOnly();}
 function applyDirection(focus=false){const enabled=!!appearance().rtl;rtl.hidden=!enabled;$('editor').style.visibility=enabled?'hidden':'';syncRtl();if(enabled&&focus)rtl.focus();}
 for(const id of ['undo','redo','cut','copy','paste','select-all']){const original=$(id).onclick;$(id).onclick=run(async()=>{if(!appearance().rtl)return original();rtl.focus();rtlSelection();if(id==='undo'||id==='redo')editor.trigger('menu',id);else if(id==='select-all'){rtl.select();rtlSelection();}else{const d=current(),range=editor.getSelection(),version=d.model.getVersionId();if(id==='paste'){const text=await navigator.clipboard.readText();if(current()!==d||d.model.getVersionId()!==version)return;editor.pushUndoStop();editor.executeEdits('rtl-paste',[{range,text,forceMoveMarkers:true}]);editor.pushUndoStop();}else{await navigator.clipboard.writeText(d.model.getValueInRange(range));if(id==='cut'&&!ctx.readOnly()&&current()===d&&d.model.getVersionId()===version){editor.pushUndoStop();editor.executeEdits('rtl-cut',[{range,text:'',forceMoveMarkers:true}]);editor.pushUndoStop();}}}});}
 editor.onDidScrollChange(()=>scheduleSpell());
 function onEdit(){syncRtl();scheduleSpell();clearTimeout(previewTimer);if(appearance().markdownMode)previewTimer=setTimeout(()=>refreshMarkdown().catch(e=>toast(e.message)),250);}
 function snapshot(d){return {id:d.id,name:d.name,path:d.path,text:d.model.getValue(),savedText:d.large?'':d.savedText,encoding:d.encoding,bom:d.bom,fingerprint:d.fingerprint,language:d.language,large:d.large,messages:d.messages,questionDraft:d.questionDraft,chatHistoryOpen:d.chatHistoryOpen,largeChats:[...d.largeChats]};}
 async function prepare(d,token){if(!d)return;const task=async()=>{if(d.large)await flushLarge(d);prepared.set(token,{id:d.id,version:d.model.getVersionId(),path:d.path});return call(api.transferPrepare({token,doc:snapshot(d)}));};return d.large?ctx.largeOperation(d,task):task();}
 api.onTransferred(run(async({id,token})=>{const record=prepared.get(token);prepared.delete(token);const d=docs.find(x=>x.id===id);if(!record||!d)return;if(d.model.getVersionId()!==record.version||d.path!==record.path){toast('转移期间原文已改变，保留原标签供你核对。');return;}await closeDoc(id,true);}));
 api.onImport(run(async({token})=>{await importTab(token);}));
 async function importTab(token){let incoming;for(let attempt=0;attempt<6;attempt++){const result=await api.transferImport({token,openPaths:docs.map(d=>d.path).filter(Boolean)});if(!result.error){incoming=result;break;}if(!result.error.includes('尚未准备好')||attempt===5)throw Error(result.error);await new Promise(r=>setTimeout(r,100));}const placeholder=docs.length===1&&!docs[0].path&&!docs[0].model.getValueLength()?docs[0]:null;activate(createDoc(incoming).id);if(placeholder)await closeDoc(placeholder.id,true);await ctx.persistNow();await call(api.transferCommit({token}));}
 const tabs=$('tabs');tabs.addEventListener('drop',event=>{const token=event.dataTransfer.getData('application/x-jianwen-transfer');if(!token||event.dataTransfer.getData('application/x-jianwen-window')===ctx.windowId())return;event.preventDefault();event.stopPropagation();run(()=>importTab(token))();},true);
 tabs.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('application/x-jianwen-transfer'))event.preventDefault();});
 document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]')||!$('preferences-page').hidden)return;
  if(event.altKey&&!event.ctrlKey&&['f','e','v'].includes(event.key.toLowerCase())){event.preventDefault();const menu={f:'file-menu',e:'edit-menu',v:'view-menu'}[event.key.toLowerCase()];document.querySelector('[aria-controls="'+menu+'"]').click();}
  if(event.ctrlKey&&event.shiftKey&&!event.altKey&&event.key.toLowerCase()==='w'){event.preventDefault();event.stopImmediatePropagation();api.windowAction('close');return;}
  if(event.ctrlKey&&event.shiftKey&&!event.altKey){const key=event.key.toLowerCase();if(['n','t','m'].includes(key)){event.preventDefault();event.stopImmediatePropagation();$({'n':'new-window','t':'reopen-tab','m':'markdown-mode'}[key]).click();}}
 },true);
 $('line-ending').tabIndex=0;$('line-ending').role='button';$('line-ending').title='点击切换 CRLF / LF（当前文本或片段）';$('line-ending').onclick=()=>{const d=current();if(!d||ctx.readOnly())return;d.model.pushStackElement();d.model.pushEOL(d.model.getEOL()==='\r\n'?monaco.editor.EndOfLineSequence.LF:monaco.editor.EndOfLineSequence.CRLF);d.model.pushStackElement();};
 $('encoding').tabIndex=0;$('encoding').role='button';$('encoding').title='点击选择编码并另存为';$('encoding').onclick=()=>$('save-encoding').click();
 return {onEdit,syncRtl,onActivate(){spellGeneration++;spellDecorations.clear();onEdit();applyDirection(true);refreshMarkdown().catch(e=>toast(e.message));},apply(){document.documentElement.dataset.rtl=String(!!appearance().rtl);$('reading-direction').setAttribute('aria-checked',String(!!appearance().rtl));applyDirection();scheduleSpell();refreshMarkdown().catch(e=>toast(e.message));},
  remember(d,discard){if(d.path||!discard){const record=snapshot(d);if(discard)record.text=record.savedText;history.push(record);while(history.length>10||history.reduce((n,x)=>n+x.text.length,0)>8*1024*1024)history.shift();}},prepare};
}
