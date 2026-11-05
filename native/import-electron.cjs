// One-time local migration. The decrypted key passes only through a private stdin pipe.
const {app,safeStorage}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const data=process.env.JIANWEN_USER_DATA;
const importData=process.env.JIANWEN_IMPORT_DATA||data;
const target=process.env.JIANWEN_IMPORT_TARGET;
if(!data||!target)throw new Error('请指定待迁移的数据目录与轻量版程序。');
app.setPath('userData',path.resolve(data));
app.whenReady().then(async()=>{
  const dest=path.join(importData,'settings-lite.json');
  try{await fs.access(dest);console.log('轻量版密钥已存在，跳过导入。');app.quit();return;}catch{}
  const config=JSON.parse(await fs.readFile(path.join(data,'settings.json'),'utf8'));
  if(!config.encryptedKey){console.log('没有需要迁移的旧密钥。');app.quit();return;}
  const key=safeStorage.decryptString(Buffer.from(config.encryptedKey,'base64'));
  const child=spawn(target,['--import-electron-key'],{env:{...process.env,JIANWEN_USER_DATA:importData},stdio:['pipe','ignore','pipe'],windowsHide:true});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);child.stdin.end(JSON.stringify({...config,encryptedKey:undefined,apiKey:key}));});
  if(code!==0)throw new Error('密钥导入进程失败。');
  const imported=JSON.parse(await fs.readFile(dest,'utf8'));
  if(!imported.protectedKey||JSON.stringify(imported).includes(key))throw new Error('密钥迁移验证失败。');
  console.log('旧密钥已迁移为当前 Windows 账户加密存储；旧配置保留。');app.quit();
}).catch(error=>{console.error(String(error.message).replace(/sk-[\w.\-]+/g,'[密钥已隐藏]'));app.exit(1);});
