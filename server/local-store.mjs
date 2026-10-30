// Local development storage only. Production continues to use SupabaseStore.
import {mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, statSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from './engine.mjs';

export class LocalFileStore {
 constructor(directory) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  this.file=path.join(directory,'rooms.json');this.lock=path.join(directory,'rooms.lock');
 }
 records() {
  let text;
  try{text=readFileSync(this.file,'utf8');}catch(error){if(error.code==='ENOENT')return {};throw error;}
  const data=JSON.parse(text);
  if(data?.version!==1||!data.records||typeof data.records!=='object'||Array.isArray(data.records))throw new Error('Invalid local room data; restore the rooms.json backup.');
  return data.records;
 }
 async locked(update) {
  let lock;
  for(let attempt=0;attempt<150;attempt++) {
   try{lock=openSync(this.lock,'wx',0o600);break;}catch(error){
    if(error.code!=='EEXIST')throw error;
    // A crashed process must not leave a permanent lock. Never steal a lock
    // from a live process; the critical section below performs no async work.
    try{
     const pid=Number(readFileSync(this.lock,'utf8'));
     if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(check){if(check.code==='ESRCH')unlinkSync(this.lock);}}
     else if(Date.now()-statSync(this.lock).mtimeMs>30000)unlinkSync(this.lock);
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,20));
   }
  }
  if(lock===undefined)throw new AppError('BUSY','Local room storage is busy. Please retry.',503);
  const temporary=`${this.file}.${randomUUID()}.tmp`;
  try{
   writeFileSync(lock,String(process.pid));
   const records=this.records();
   const result=update(records);
   let file;
   try{file=openSync(temporary,'wx',0o600);writeFileSync(file,JSON.stringify({version:1,records}));fsyncSync(file);}finally{if(file!==undefined)closeSync(file);}
   renameSync(temporary,this.file);
   return result;
  }finally{
   closeSync(lock);unlinkSync(this.lock);
   try{unlinkSync(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
 async read(code){return this.records()[code]||null;}
 async byOwner(hash){return Object.values(this.records()).find(record=>record.ownerHash===hash)||null;}
 async insert(state,ownerHash){return this.locked(records=>{
  if(records[state.code]||Object.values(records).some(record=>record.ownerHash===ownerHash))throw new AppError('CONFLICT','Room already exists.',409);
  records[state.code]={state:structuredClone(state),ownerHash,revision:1};
 });}
 async cas(code,revision,state){return this.locked(records=>{
  const record=records[code];if(!record||record.revision!==revision)return false;
  records[code]={...record,state:structuredClone(state),revision:revision+1};return true;
 });}
}
