import nspell from 'nspell';
import aff from '../node_modules/dictionary-en/index.aff?raw';
import dic from '../node_modules/dictionary-en/index.dic?raw';
const dictionary=nspell({aff,dic});
const automatic=new Map([['teh','the'],['recieve','receive'],['adress','address'],['wierd','weird'],['definately','definitely'],['seperate','separate'],['thier','their']]);
self.onmessage=({data:{id,text}})=>{
 try{
  const issues=[],cache=new Map();
  for(const match of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)){
   const word=match[0];if(word.length<2||word.length>48||dictionary.correct(word))continue;
   if(!cache.has(word))cache.set(word,dictionary.suggest(word).slice(0,5));const suggestions=cache.get(word);
   const correction=automatic.get(word.toLowerCase());issues.push({start:match.index,length:word.length,action:correction||suggestions.length===1?2:1,replacement:correction||(suggestions.length===1?suggestions[0]:''),suggestions});
   if(issues.length>=60)break;
  }
  self.postMessage({id,issues});
 }catch(e){self.postMessage({id,error:e.message});}
};
