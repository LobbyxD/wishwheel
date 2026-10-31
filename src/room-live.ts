import {liveSocketEndpoint,liveTicketEndpoint} from './deployment';
import type {RoomEvent} from './room-state';

export function subscribeRoom({code,token,onEvent,onRefresh,onConnection,onSettle}:{code:string;token:string;onEvent:(event:RoomEvent)=>void;onRefresh:()=>void;onConnection:(connected:boolean)=>void;onSettle:(event:RoomEvent)=>void}){
 let closed=false,socket:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined;
 let refreshTimer:ReturnType<typeof setTimeout>|undefined,lastRefresh=0,attempt=0,lastMessage=Date.now(),controller:AbortController|null=null;
 const deadlines=new Set<ReturnType<typeof setTimeout>>();
 const refresh=()=>{if(closed||document.hidden)return;if(refreshTimer)return;refreshTimer=setTimeout(()=>{refreshTimer=undefined;lastRefresh=Date.now();onRefresh();},Math.max(0,1000-(Date.now()-lastRefresh)));};
 const disconnect=()=>{controller?.abort();controller=null;if(heartbeat)clearInterval(heartbeat);heartbeat=undefined;const previous=socket;socket=null;previous?.close();onConnection(false);};
 const schedule=()=>{if(!closed&&!document.hidden){clearTimeout(retry);retry=setTimeout(()=>void connect(),Math.min(1000*2**attempt++,15000));}};
 async function connect(){
  if(closed||document.hidden||socket)return;
  controller=new AbortController();const current=controller;
  try{
   const response=await fetch(liveTicketEndpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({code}),signal:current.signal});
   if(!response.ok)throw new Error('Live subscription unavailable');
   const {ticket}=await response.json();if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw new Error('Invalid subscription');
   if(closed||current.signal.aborted||document.hidden)return;
   const url=new URL(liveSocketEndpoint||'/api/live',location.origin.replace(/^http/,'ws'));url.searchParams.set('code',code);
   const connection=new WebSocket(url,['wishwheel-v1',ticket]);socket=connection;
   connection.onopen=()=>{if(closed||socket!==connection)return;attempt=0;lastMessage=Date.now();onConnection(true);refresh();heartbeat=setInterval(()=>{if(Date.now()-lastMessage>60000)connection.close();else if(connection.readyState===WebSocket.OPEN)connection.send('ping');},25000);};
   connection.onmessage=message=>{
    if(closed||socket!==connection)return;lastMessage=Date.now();if(message.data==='pong')return;
    try{if(typeof message.data!=='string'||message.data.length>2048)return;const event=JSON.parse(message.data) as RoomEvent;
     if(event.type!=='room-changed'||event.code!==code)return;
     onEvent(event);if(event.kind!=='spin')refresh();
     const end=event.member?.spinEndsAt;
     if(event.kind==='spin'&&typeof end==='number'&&typeof event.serverNow==='number'){
      const timer=setTimeout(()=>{deadlines.delete(timer);onSettle(event);},Math.max(0,Math.min(6500,end-event.serverNow+80)));deadlines.add(timer);
     }
    }catch{/* Ignore malformed notifications; authenticated state remains authoritative. */}
   };
   connection.onerror=()=>connection.close();
   connection.onclose=()=>{if(socket!==connection)return;socket=null;if(heartbeat)clearInterval(heartbeat);heartbeat=undefined;onConnection(false);refresh();schedule();};
  }catch{if(!closed&&!current.signal.aborted){onConnection(false);schedule();}}
 }
 const visibility=()=>{if(document.hidden){clearTimeout(retry);disconnect();}else{refresh();void connect();}};
 document.addEventListener('visibilitychange',visibility);void connect();
 return()=>{closed=true;clearTimeout(retry);clearTimeout(refreshTimer);for(const timer of deadlines)clearTimeout(timer);disconnect();document.removeEventListener('visibilitychange',visibility);};
}
