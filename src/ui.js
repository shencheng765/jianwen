import {fontSizes} from './appearance.js';
export function mountInterface(icons){
 document.getElementById('app').innerHTML=`
 <header class="titlebar">
   <div class="settings-caption"><button id="preferences-close" class="icon-button" title="返回编辑器" aria-label="返回编辑器"><svg viewBox="0 0 20 20"><path d="m9 4-6 6 6 6M3 10h14"/></svg></button><span class="settings-app-icon">${icons.logo}</span><span>简文</span></div>
   <div class="app-icon" title="简文">${icons.logo}</div>
   <button id="tabs-back" class="tab-scroll" aria-label="向左滚动标签页" title="向左滚动标签页" hidden>◀</button>
   <div id="tabs" role="tablist" aria-label="打开的文本"></div>
   <button id="tabs-forward" class="tab-scroll" aria-label="向右滚动标签页" title="向右滚动标签页" hidden>▶</button>
   <button id="tab-new" class="icon-button" title="新建标签页 · Ctrl+N">${icons.plus}</button>
   <div class="titlebar-space"></div>
 </header>
 <nav class="menubar" aria-label="菜单栏">
  <div class="menu-group"><button class="menu-trigger" id="file-menu-button" aria-expanded="false" aria-controls="file-menu">文件</button>
   <div class="menu-popup" id="file-menu" role="menu" hidden>
    <button id="new" role="menuitem"><span>新建标签页</span><kbd>Ctrl+N</kbd></button>
    <button id="open" role="menuitem"><span>打开…</span><kbd>Ctrl+O</kbd></button><hr>
    <button id="save" role="menuitem"><span>保存</span><kbd>Ctrl+S</kbd></button>
    <button id="save-as" role="menuitem"><span>另存为…</span><kbd>Ctrl+Shift+S</kbd></button><hr>
    <button id="print" role="menuitem"><span>打印…</span><kbd>Ctrl+P</kbd></button><hr>
    <button id="close-tab" role="menuitem"><span>关闭标签页</span><kbd>Ctrl+W</kbd></button>
   </div>
  </div>
  <div class="menu-group"><button class="menu-trigger" id="edit-menu-button" aria-expanded="false" aria-controls="edit-menu">编辑</button>
   <div class="menu-popup" id="edit-menu" role="menu" hidden>
    <button id="undo" role="menuitem"><span>撤销</span><kbd>Ctrl+Z</kbd></button>
    <button id="redo" role="menuitem"><span>重做</span><kbd>Ctrl+Y</kbd></button><hr>
    <button id="cut" role="menuitem"><span>剪切</span><kbd>Ctrl+X</kbd></button>
    <button id="copy" role="menuitem"><span>复制</span><kbd>Ctrl+C</kbd></button>
    <button id="copy-plain" role="menuitem"><span>复制为纯文本</span><kbd>Ctrl+Shift+C</kbd></button>
    <button id="paste" role="menuitem"><span>粘贴</span><kbd>Ctrl+V</kbd></button>
    <button id="select-all" role="menuitem"><span>全选</span><kbd>Ctrl+A</kbd></button><hr>
    <button id="find" role="menuitem"><span>查找</span><kbd>Ctrl+F</kbd></button>
    <button id="replace" role="menuitem"><span>替换</span><kbd>Ctrl+H</kbd></button>
    <button id="go-line" role="menuitem"><span>跳转到行…</span><kbd>Ctrl+G</kbd></button>
    <button id="insert-time" role="menuitem"><span>时间和日期</span><kbd>F5</kbd></button>
   </div>
  </div>
  <div class="menu-group"><button class="menu-trigger" id="view-menu-button" aria-expanded="false" aria-controls="view-menu">查看</button>
   <div class="menu-popup" id="view-menu" role="menu" hidden>
    <button id="theme-light" role="menuitemradio" aria-checked="true"><span>白色背景</span><span class="menu-check">✓</span></button>
    <button id="theme-dark" role="menuitemradio" aria-checked="false"><span>黑色背景</span><span class="menu-check">✓</span></button><hr>
    <button id="menu-lines" role="menuitemcheckbox" aria-checked="false"><span>显示行号</span><span class="menu-check">✓</span></button>
    <button id="menu-wrap" role="menuitemcheckbox" aria-checked="true"><span>自动换行</span><span class="menu-check">✓</span></button><hr>
    <button id="menu-status" role="menuitemcheckbox" aria-checked="true"><span>状态栏</span><span class="menu-check">✓</span></button>
    <button id="font-settings" role="menuitem">字体与外观…</button>
   </div>
  </div>
  <div class="menu-space"></div>
  <button id="toggle-ai" class="ai-toggle" aria-pressed="false" title="显示 / 隐藏 AI 侧栏"><span id="ai-toggle-name">AI 助手</span></button>
  <button id="preferences" class="icon-button" title="设置">${icons.settings}</button>
 </nav>
 <main id="layout" class="ai-hidden">
  <section class="document-area"><div id="large-toolbar" hidden>
    <div class="large-controls"><strong id="large-size"></strong><button id="large-prev" title="上一片段">‹</button><label>第 <input id="large-index" type="number" min="1" value="1" aria-label="片段序号"></label><span id="large-total"></span><button id="large-go">跳转</button><button id="large-next" title="下一片段">›</button><input id="large-range" type="range" min="1" value="1" aria-label="跳转到大文件片段"><select id="large-encoding" aria-label="大文件编码"><option value="utf8">UTF-8</option><option value="gb18030">GB18030</option><option value="utf16-le">UTF-16 LE</option><option value="utf16-be">UTF-16 BE</option></select></div>
    <div id="large-state" role="status"></div>
  </div><div id="editor-shell"><div id="editor"></div><div id="placeholder" hidden></div></div></section>
  <div id="ai-resizer" class="panel-resizer" role="separator" aria-label="调整 AI 侧栏宽度" aria-orientation="vertical" aria-valuemin="280" aria-valuemax="900" tabindex="0" title="拖动调整 AI 宽度；双击恢复默认"></div>
  <aside id="ai-panel">
   <div class="ai-heading"><span class="ai-brand-icon" aria-hidden="true">${icons.spark}</span><div class="ai-heading-copy"><strong id="ai-name-label">AI 助手</strong><span>写作 · 命令 · 文本整理</span></div><div class="ai-heading-actions"><button id="settings" class="icon-button" title="AI 设置">${icons.settings}</button><button id="hide-ai" class="icon-button" title="收起 AI">${icons.close}</button></div></div>
   <div class="ai-context"><span id="connection-dot" class="dot"></span><span class="context-prefix">当前页</span><span id="context-name">当前标签页</span></div>
   <div class="review-toolbar"><button id="review" class="primary">检查当前文本</button><label class="auto-label" title="停止输入 8 秒后检查，同一时间最多每 45 秒一次"><input id="auto-review" type="checkbox"><span>自动提醒</span></label></div>
   <div class="conversation-tools"><span>对话</span><button id="clear-chat" class="text-link" title="清空当前页的全部对话和聊天上下文">清空对话</button></div>
   <div id="ai-scroll"><div id="review-pending"></div><div id="review-results"></div><div id="chat" aria-label="AI 对话"></div></div>
   <div id="composer-resizer" role="separator" aria-label="调整 AI 输入框高度" aria-orientation="horizontal" tabindex="0" title="拖动调整输入框高度；双击恢复默认"></div>
   <div class="composer"><label id="question-label" for="question">告诉 AI 你的想法</label><div class="question-box"><textarea id="question" aria-describedby="question-hint" placeholder="想写什么，或想怎么修改当前文本？"></textarea><div class="composer-actions"><span id="question-hint">Ctrl + Enter 发送</span><button id="send" class="send-button" title="发送 · Ctrl+Enter" aria-label="发送消息">${icons.arrow}</button></div></div><div class="context-note">AI 可直接写入当前页 · Ctrl+Z 撤销</div><div id="ai-state" role="status">先配置你的模型，就可以开始了</div></div>
  </aside>
 </main>
 <footer class="statusbar"><span id="cursor">行 1，列 1</span><span id="count">0 个字符</span><span id="file-state">未保存</span><div class="status-right"><button id="zoom" class="status-button" title="Ctrl＋滚轮缩放；点击或 Ctrl＋0 恢复 100%" aria-label="缩放 100%，点击恢复默认">100%</button><select id="language" aria-label="语法高亮语言" title="选择当前标签页的高亮语言"></select><button id="wrap" class="status-button" title="切换自动换行">自动换行</button><span id="line-ending">Windows (CRLF)</span><span id="encoding">UTF-8</span></div></footer>
 <div id="toast" role="status"></div>
 <section id="preferences-page" class="settings-page" aria-label="设置" hidden>
  <div class="settings-content">
   <div class="settings-heading"><h1>设置</h1></div>
   <div class="settings-columns"><div class="settings-main">
   <h3 class="settings-section-title">外观</h3>
   <details id="theme-card" class="settings-card"><summary><span class="card-icon">${icons.palette}</span><span class="card-copy"><strong>应用主题</strong><small>选择要显示的应用主题</small></span>${icons.chevron}</summary><div class="setting-row"><label for="theme">背景颜色</label><select id="theme" aria-label="背景颜色"><option value="light">浅色 · 纯白</option><option value="dark">深色 · 黑色</option></select></div></details>
   <h3 class="settings-section-title">文本格式</h3>
   <details class="settings-card font-card"><summary><span class="card-icon font-icon">A<span>A</span></span><span class="card-copy"><strong>字体</strong></span>${icons.chevron}</summary>
    <div class="setting-row"><label for="font-family">字体系列</label><select id="font-family" aria-label="字体系列"><option value="Microsoft YaHei">微软雅黑</option></select></div>
    <div class="setting-row"><label for="font-style">样式</label><select id="font-style" aria-label="字体样式"><option>Regular</option><option>Italic</option><option>Bold</option><option>Bold Italic</option></select></div>
    <div class="setting-row"><label for="font-size">大小</label><select id="font-size" aria-label="字体大小（磅）" title="字号单位：磅（pt）">${fontSizes.map(size=>`<option value="${size}">${size}</option>`).join('')}</select></div>
    <div class="font-preview" id="font-preview" aria-label="字体预览">海浪的声音平静了我的心灵。</div>
   </details>
   <label class="settings-card toggle-card"><span class="card-icon">${icons.wrap}</span><span class="card-copy"><strong>自动换行</strong><small>在窗口中调整文本</small></span><input id="wrap-setting" class="switch" type="checkbox" role="switch" checked><span class="switch-state" aria-hidden="true"></span></label>
   <label class="settings-card toggle-card"><span class="card-icon">${icons.lines}</span><span class="card-copy"><strong>显示行号</strong><small>在文本左侧显示行数</small></span><input id="line-numbers" class="switch" type="checkbox" role="switch"><span class="switch-state" aria-hidden="true"></span></label>
   <h3 class="settings-section-title">AI 助手</h3>
   <details class="settings-card"><summary><span class="card-icon">${icons.spark}</span><span class="card-copy"><strong>侧栏大小</strong><small>也可以拖动侧栏和输入区边缘调整</small></span>${icons.chevron}</summary><div class="setting-row"><label for="ai-width">侧栏宽度（像素）</label><input id="ai-width" type="number" min="280" max="900" step="10"></div><div class="setting-row"><label for="input-height">输入框高度（像素）</label><input id="input-height" type="number" min="80" max="420" step="10"></div></details>
   <button id="ai-preferences" class="settings-card settings-link"><span class="card-icon">${icons.settings}</span><span class="card-copy"><strong>名称、模型与思考强度</strong><small>连接自己的 AI 模型</small></span><span class="link-arrow">↗</span></button>
   <p class="settings-note">设置立即生效，自动保存。</p>
   </div><aside class="settings-about"><h3>关于此应用</h3><p>简文 <span id="settings-version"></span></p><p>轻量文本编辑器</p></aside></div>
  </div>
 </section>
 <dialog id="go-line-dialog"><form id="go-line-form"><h2>跳转到行</h2><label>行号<input id="go-line-number" type="number" min="1" required></label><p id="go-line-hint"></p><div class="dialog-actions"><button type="button" id="go-line-cancel">取消</button><button type="submit" class="primary">跳转</button></div></form></dialog>
 <dialog id="settings-dialog"><form id="settings-form">
  <div class="dialog-heading"><h2>AI 设置</h2><button type="button" id="settings-close" class="icon-button" title="关闭">${icons.close}</button></div>
  <label>助手名称<input id="assistant-name" maxlength="40" placeholder="AI 助手" autocomplete="off"></label>
  <label>接口地址<input id="base-url" type="url" placeholder="请输入接口地址" required spellcheck="false"></label>
  <label>API Key<input id="api-key" type="password" placeholder="请输入 API Key" autocomplete="off" spellcheck="false"></label>
  <label>模型名称<input id="model" placeholder="请输入模型名称" required spellcheck="false"></label>
  <label>思考强度<select id="reasoning-effort"><option value="">跟随模型默认</option><option value="none">关闭（none）</option><option value="minimal">最低（minimal）</option><option value="low">低（low）</option><option value="medium">中（medium）</option><option value="high">高（high）</option><option value="xhigh">极高（xhigh）</option><option value="max">最高（max）</option><option value="ultra">超高（ultra，接口扩展）</option></select></label>
  <p class="key-note">不同模型支持的档位不同；选“默认”时不附加强度参数。密钥在本机加密保存。</p>
  <div id="settings-status" role="status"></div>
  <div class="dialog-actions"><button type="button" id="test-connection" class="secondary">测试连接</button><button type="submit" class="primary" id="settings-save">保存</button></div>
 </form></dialog>`;
}

export function setupMenus(){
 const buttons=[...document.querySelectorAll('.menu-trigger')];
 const close=()=>{for(const b of buttons){b.setAttribute('aria-expanded','false');document.getElementById(b.getAttribute('aria-controls')).hidden=true;}};
 for(const b of buttons){
  b.onclick=()=>{const opening=b.getAttribute('aria-expanded')!=='true';close();if(opening){b.setAttribute('aria-expanded','true');document.getElementById(b.getAttribute('aria-controls')).hidden=false;}};
  b.onmouseenter=()=>{if(buttons.some(x=>x.getAttribute('aria-expanded')==='true')){close();b.setAttribute('aria-expanded','true');document.getElementById(b.getAttribute('aria-controls')).hidden=false;}};
  b.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();close();b.click();document.getElementById(b.getAttribute('aria-controls')).querySelector('button').focus();}};
 }
 document.addEventListener('click',event=>{if(!event.target.closest('.menu-group'))close();else if(event.target.closest('.menu-popup button'))close();});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')close();
  const popup=event.target.closest('.menu-popup');if(!popup)return;
  const items=[...popup.querySelectorAll('button')],index=items.indexOf(document.activeElement);
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}
 });
 window.addEventListener('blur',close);
 return close;
}
