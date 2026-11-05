import {marked} from 'marked';
import DOMPurify from 'dompurify';
export function renderMarkdown(pane,text,{partial=false,api,path}={}){
 const limit=500000,clipped=text.length>limit;
 const html=marked.parse(text.slice(0,limit),{gfm:true,breaks:false});
 const clean=DOMPurify.sanitize(html,{USE_PROFILES:{html:true},FORBID_TAGS:['video','audio','iframe','style','form','button'],FORBID_ATTR:['style','srcset']});
 // Build off-document: image URLs are removed before any node joins the live preview.
 const template=document.createElement('template');template.innerHTML=clean;
 for(const image of template.content.querySelectorAll('img')){const src=image.getAttribute('src')||'',label=image.alt||src;image.removeAttribute('src');const button=document.createElement('button');button.className='preview-image';button.textContent='加载图片：'+label;button.title=src;button.onclick=async()=>{button.disabled=true;try{if(!api?.loadImage)throw Error('当前宿主不支持图片预览');const result=await api.loadImage({path,src});if(result.error)throw Error(result.error);image.src=result.url;button.replaceWith(image);}catch(e){button.textContent=e.message;button.disabled=false;}};image.replaceWith(button);}
 for(const checkbox of template.content.querySelectorAll('input')){const mark=document.createTextNode(checkbox.checked?'☑ ':'☐ ');checkbox.replaceWith(mark);}
 pane.replaceChildren(template.content);
 for(const link of pane.querySelectorAll('a')){const href=link.getAttribute('href')||'';link.removeAttribute('href');link.tabIndex=0;link.setAttribute('role','link');link.title=href;link.onclick=async event=>{event.preventDefault();if(href.startsWith('#')){const target=[...pane.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(x=>x.textContent.toLowerCase().replace(/\s/g,'-')===decodeURIComponent(href.slice(1)));target?.scrollIntoView();return;}if(!/^https?:\/\//i.test(href))return;const result=await api?.openLink?.(href);if(result?.error)link.title=result.error;};link.onkeydown=event=>{if(event.key==='Enter')link.click();};}
 if(clipped||partial){const note=document.createElement('p');note.className='preview-note';note.textContent=partial?'大文件预览仅显示当前片段。':'预览显示前 50 万字符，正文与保存内容保持完整。';pane.prepend(note);}
}
