let worker,next=0;const pending=new Map();
export function checkEnglish(text){
 if(!worker){worker=new Worker(new URL('./spelling-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const request=pending.get(data.id);if(!request)return;pending.delete(data.id);request.resolve(data);};worker.onerror=()=>{for(const request of pending.values())request.reject(Error('离线拼写词典加载失败，请重新打开窗口。'));pending.clear();worker.terminate();worker=null;};}
 return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,text});});
}
