const crypto = require('node:crypto');
const iconv = require('iconv-lite');

function decodeFile(buffer) {
  if (buffer.includes(0) && !(buffer[0] === 0xff && buffer[1] === 0xfe) && !(buffer[0] === 0xfe && buffer[1] === 0xff)) {
    throw new Error('这是二进制文件，简文只打开文本文件。');
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return {text: iconv.decode(buffer.subarray(2), 'utf16-le'), encoding:'utf16-le', bom:true};
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return {text: iconv.decode(buffer.subarray(2), 'utf16-be'), encoding:'utf16-be', bom:true};
  const bom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const body = bom ? buffer.subarray(3) : buffer;
  try { return {text: new TextDecoder('utf-8', {fatal:true}).decode(body), encoding:'utf8', bom}; }
  catch { return {text:iconv.decode(body, 'gb18030'), encoding:'gb18030', bom:false}; }
}

function encodeFile(text, encoding='utf8', bom=false) {
  const bytes = iconv.encode(text, encoding);
  // Refuse silent character loss when editing an older ANSI/GBK document.
  if (iconv.decode(bytes, encoding) !== text) throw new Error('当前编码无法保存这些字符，请选择“另存为”以 UTF-8 保存。');
  const prefix = bom ? ({utf8:[0xef,0xbb,0xbf], 'utf16-le':[0xff,0xfe], 'utf16-be':[0xfe,0xff]}[encoding] || []) : [];
  return Buffer.concat([Buffer.from(prefix), bytes]);
}

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function normalizeEndpoint(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('请输入 http 或 https 接口地址，地址中不要包含密钥。');
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') + '/chat/completions';
  return url.toString();
}

function extractContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content.map(x=>x.text||'').join('');
    if (text.trim()) return text;
  }
  throw new Error('接口没有返回文本，请检查模型名称和接口兼容性。');
}

function parseReview(value, lineCount) {
  let clean = String(value).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;
  try { parsed = JSON.parse(clean); }
  catch {
    const start=clean.indexOf('{'),end=clean.lastIndexOf('}');
    if (start<0 || end<=start) throw new Error('AI 没有返回有效的检查结果，请重试。');
    parsed=JSON.parse(clean.slice(start,end+1));
  }
  if (!parsed || typeof parsed.summary !== 'string' || !Array.isArray(parsed.issues)) throw new Error('AI 的检查结果缺少必要字段，请重试。');
  const issues = parsed.issues.filter(x=>x&&typeof x==='object').slice(0,12).map(x=>({
    line:Math.min(lineCount,Math.max(1,Math.trunc(Number(x.line)||1))),
    severity:x.severity==='error'?'error':x.severity==='info'?'info':'warning',
    title:String(x.title||'检查建议').slice(0,160),
    message:String(x.message||'').slice(0,2400),
    original:typeof x.original==='string'?x.original.slice(0,6000):'',
    replacement:typeof x.replacement==='string'?x.replacement.slice(0,6000):null
  }));
  return {summary:String(parsed.summary|| (issues.length?'发现以下可以留意的地方。':'暂未发现明显问题。')).slice(0,1000),issues};
}

function replacementRange(text, issue) {
  if (!issue.original || typeof issue.replacement !== 'string') return null;
  const lines=text.split('\n');
  const offset=lines.slice(0,issue.line-1).reduce((sum,s)=>sum+s.length+1,0);
  const lineEnd=offset+(lines[issue.line-1]?.length||0);
  const index=text.indexOf(issue.original,offset);
  if(index<offset || index>lineEnd) return null;
  return {start:index,end:index+issue.original.length};
}

module.exports={decodeFile,encodeFile,digest,normalizeEndpoint,extractContent,parseReview,replacementRange};
