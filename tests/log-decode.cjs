const assert=require('node:assert/strict');
const {decodeFile,encodeFile}=require('../electron/core.cjs');
const iconv=require('iconv-lite');
const fixtures=[
  [Buffer.from('中文日志\r\n'),'utf8'],
  [Buffer.from('x'.repeat(1000)+'\0\0\r\n'),'utf8'],
  [iconv.encode('x'.repeat(1000)+'中文\0\r\n','gb18030'),'gb18030'],
  [Buffer.concat([Buffer.alloc(1000,120),Buffer.from([0,255,255,13,10])]),'latin1'],
];
for(const [bytes,encoding] of fixtures){
  const result=decodeFile(bytes);assert.equal(result.encoding,encoding);
  assert.deepEqual(encodeFile(result.text,result.encoding,result.bom),bytes);
}
for(const bytes of [Buffer.alloc(100),Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from([80,75,3,4,65,66,67,68])])assert.throws(()=>decodeFile(bytes));
if(process.argv[2]){
  const bytes=require('node:fs').readFileSync(process.argv[2]),result=decodeFile(bytes);
  assert.equal(result.encoding,'latin1');assert.deepEqual(encodeFile(result.text,result.encoding,result.bom),bytes);
}
console.log('PASS Electron sparse-control and mixed-byte regression checks');
