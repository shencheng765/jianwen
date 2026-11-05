// Model responses are untrusted text. Build every node explicitly; never insert
// response HTML, even when displaying simple Markdown or fenced code blocks.
function inlineText(parent,text){
  const pattern=/`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;let offset=0,match;
  while((match=pattern.exec(text))){
    parent.append(document.createTextNode(text.slice(offset,match.index)));
    const node=document.createElement(match[1]!==undefined?'code':'strong');
    node.textContent=match[1]??match[2];parent.append(node);offset=pattern.lastIndex;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}
function copyButton(text,label,onError){
  const button=document.createElement('button');button.className='message-copy';button.type='button';
  button.title=label;button.setAttribute('aria-label',label);
  button.innerHTML='<svg viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="10" rx="2"/><path d="M12 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>';
  button.onclick=async()=>{
    try{await navigator.clipboard.writeText(text);button.classList.add('copied');button.title='已复制';button.setAttribute('aria-label','已复制');setTimeout(()=>{button.classList.remove('copied');button.title=label;button.setAttribute('aria-label',label);},1600);}
    catch{onError('复制失败，请选中文字后按 Ctrl+C。');}
  };
  return button;
}
function messageBody(content,onError){
  const body=document.createElement('div');body.className='message-body';
  const prose=text=>{if(!text.trim())return;const node=document.createElement('div');node.className='message-prose';inlineText(node,text.replace(/^[\r\n]+|[\r\n]+$/g,''));body.append(node);};
  const fences=/```([^\r\n`]*)\r?\n([\s\S]*?)(?:```|$)/g;let offset=0,match;
  while((match=fences.exec(content))){
    prose(content.slice(offset,match.index));
    const block=document.createElement('div');block.className='chat-code';
    const bar=document.createElement('div');bar.className='chat-code-bar';
    const language=document.createElement('span');language.textContent=match[1].trim().slice(0,40)||'代码';
    bar.append(language,copyButton(match[2],'复制代码',onError));
    const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=match[2];pre.append(code);block.append(bar,pre);body.append(block);offset=fences.lastIndex;
  }
  prose(content.slice(offset));return body;
}
function messageCard(message,{name,spark,onError}){
  const assistant=message.role!=='user';
  const item=document.createElement('article');item.className='message '+(assistant?'assistant':'user');
  const header=document.createElement('header');header.className='message-header';
  const avatar=document.createElement('span');avatar.className='message-avatar';avatar.setAttribute('aria-hidden','true');
  avatar.innerHTML=assistant?spark:'<svg viewBox="0 0 20 20"><circle cx="10" cy="6" r="3"/><path d="M4 17v-2a6 6 0 0 1 12 0v2"/></svg>';
  const author=document.createElement('span');author.className='message-author';author.textContent=assistant?name:'你';
  header.append(avatar,author,copyButton(message.content,'复制这条消息',onError));
  item.append(header,messageBody(message.content,onError));return item;
}
export function renderConversation(root,doc,options){
  root.replaceChildren();if(!doc?.messages.length)return;
  const messages=doc.messages;let latest=messages.length-1;
  while(latest>0&&messages[latest].role!=='user')latest--;
  if(latest>0){
    const history=document.createElement('details');history.className='chat-history';history.open=doc.chatHistoryOpen===true;
    const summary=document.createElement('summary');
    const title=document.createElement('span');title.className='history-title';title.textContent='历史对话';
    const count=document.createElement('span');count.className='history-count';count.textContent=messages.slice(0,latest).filter(m=>m.role==='user').length+' 轮';
    const chevron=document.createElement('span');chevron.className='history-chevron';chevron.innerHTML='<svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>';chevron.setAttribute('aria-hidden','true');
    summary.append(title,count,chevron);history.append(summary);
    const list=document.createElement('div');list.className='history-list';history.append(list);
    const populate=()=>{list.replaceChildren();if(history.open)for(const message of messages.slice(0,latest))list.append(messageCard(message,options));};
    history.addEventListener('toggle',()=>{if(!history.isConnected)return;doc.chatHistoryOpen=history.open;populate();});populate();root.append(history);
  }
  const section=document.createElement('section');section.className='latest-round';section.setAttribute('aria-label','最新对话');
  const label=document.createElement('div');label.className='chat-section-label';label.textContent='最新对话';section.append(label);
  for(const message of messages.slice(latest))section.append(messageCard(message,options));root.append(section);
}
export function showPending(root,enabled,name,detail='正在回复…'){
  const existing=root.querySelector('.chat-pending');
  if(!enabled){existing?.remove();return;}
  if(existing){existing.querySelector('.pending-text').textContent=name+' · '+detail;return;}
  const status=document.createElement('div');status.className='chat-pending';status.setAttribute('role','status');
  const dots=document.createElement('span');dots.className='typing-dots';dots.setAttribute('aria-hidden','true');
  for(let i=0;i<3;i++)dots.append(document.createElement('i'));
  const text=document.createElement('span');text.className='pending-text';text.textContent=name+' · '+detail;status.append(dots,text);root.append(status);
}
