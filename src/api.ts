import {apiEndpoint} from './deployment';
import type {State} from './types';
export const makeToken=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');};
export async function request<T=State>(action:string, token:string, data:Record<string,unknown>={},signal?:AbortSignal):Promise<T>{
 const r=await fetch(apiEndpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...data}),signal});
 let body;try{body=await r.json();}catch{throw new Error('The room service is not available yet. Please try again shortly.');}
 if(!r.ok){const e=new Error(body.error?.message||body.error||body.message||'Something went wrong.') as Error & {code?:string};e.code=body.error?.code;throw e;}
 return body;
}
export type Saved={code:string;token:string;name:string;title:string;updated:number;isOwner?:boolean;phase?:State['room']['phase']};
function validSaved(value:unknown):value is Saved {
 const room=value as Saved;
 return !!room&&typeof room==='object'&&typeof room.code==='string'&&/^[A-Z2-9]{6}$/.test(room.code)&&typeof room.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(room.token)&&typeof room.name==='string'&&room.name.length>0&&room.name.length<=32&&typeof room.title==='string'&&room.title.length<=60&&Number.isFinite(room.updated)&&room.updated>=0&&room.updated<=8.64e15&&(room.isOwner===undefined||typeof room.isOwner==='boolean')&&(room.phase===undefined||['lobby','active','complete'].includes(room.phase));
}
export function savedRooms():Saved[]{try{const rooms=JSON.parse(localStorage.getItem('ww.rooms')||'[]');return Array.isArray(rooms)?rooms.filter(validSaved):[];}catch{return [];}}
export function saveRoom(s:State,token:string){
 const room:Saved={code:s.room.code,token,name:s.me.name,title:s.room.settings.title,updated:Date.now(),isOwner:s.me.isOwner,phase:s.room.phase};
 const existing=savedRooms(),previous=existing.find(saved=>saved.code===room.code);
 if(previous&&previous.token===token&&previous.name===room.name&&previous.title===room.title&&previous.isOwner===room.isOwner&&previous.phase===room.phase&&room.updated-previous.updated<60000)return true;
 try{localStorage.setItem('ww.rooms',JSON.stringify([room,...existing.filter(x=>x.code!==room.code)]));return true;}catch{return false;}
}
export function forgetRoom(code:string){try{localStorage.setItem('ww.rooms',JSON.stringify(savedRooms().filter(room=>room.code!==code)));}catch{}}
export function recoveryFile(rooms:Saved[]){return JSON.stringify({format:'wishwheel-recovery',version:1,rooms},null,2);}
export function importRecoveryFile(text:string):number {
 if(text.length>2_000_000)throw new Error('INVALID_BACKUP');
 const data=JSON.parse(text);
 if(data?.format!=='wishwheel-recovery'||data.version!==1||!Array.isArray(data.rooms)||!data.rooms.length||!data.rooms.every(validSaved))throw new Error('INVALID_BACKUP');
 const rooms=new Map(savedRooms().map(room=>[room.code,room]));
 for(const incoming of data.rooms as Saved[]){
  const existing=rooms.get(incoming.code);
  if(!existing||incoming.isOwner&&!existing.isOwner||!!incoming.isOwner===!!existing.isOwner&&incoming.updated>existing.updated)rooms.set(incoming.code,incoming);
 }
 localStorage.setItem('ww.rooms',JSON.stringify([...rooms.values()].sort((a,b)=>b.updated-a.updated)));
 return data.rooms.length;
}
export function downloadRecoveryFile(rooms:Saved[]){
 const blob=new Blob([recoveryFile(rooms)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=rooms.length===1?`wishwheel-${rooms[0].code}-private.json`:'wishwheel-private-rooms.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
