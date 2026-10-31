import {hashToken,newToken,validToken} from './engine.mjs';

export const LIVE_TICKET_MS=60000;
export const isRoomMutation=action=>!['state','preview'].includes(action);
export function publicRoomEvent(result,kind){
 const {room,me}=result,actor=room.members.find(member=>member.id===me.id);
 return {type:'room-changed',code:room.code,generation:room.generation,version:room.version,phase:room.phase,serverNow:room.serverNow,kind,
  ...(actor?{member:{id:actor.id,name:actor.name,status:actor.status,spinStartedAt:actor.spinStartedAt??null,spinEndsAt:actor.spinEndsAt??null}}:{})};
}
export function ticketFromProtocols(header){return String(header||'').split(',').map(value=>value.trim()).find(validToken)||null;}

// No room state is stored here. SQLite-backed Durable Objects coordinate only
// short-lived subscription tickets and hibernating public-notification sockets.
export class RoomLive{
 constructor(ctx){this.ctx=ctx;if(typeof WebSocketRequestResponsePair!=='undefined')ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/issue'&&request.method==='POST'){
   const {memberId}=await request.json(),ticket=newToken(),expiresAt=Date.now()+LIVE_TICKET_MS;
   await this.ctx.storage.put(`ticket:${hashToken(ticket)}`,{memberId,expiresAt});
   const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm>expiresAt)await this.ctx.storage.setAlarm(expiresAt);
   return Response.json({ticket,expiresAt});
  }
  if(path==='/notify'&&request.method==='POST'){
   const {event,memberIds,revokeMemberId}=await request.json(),allowed=new Set(memberIds),message=JSON.stringify(event);
   for(const socket of this.ctx.getWebSockets()){
    const memberId=socket.deserializeAttachment()?.memberId;
    if(!allowed.has(memberId)||memberId===revokeMemberId){socket.close(1008,'Membership changed');continue;}
    try{socket.send(message);}catch{try{socket.close(1011,'Reconnect');}catch{}}
   }
   return new Response(null,{status:204});
  }
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const ticket=ticketFromProtocols(request.headers.get('Sec-WebSocket-Protocol'));
  if(!ticket)return new Response('Subscription required',{status:401});
  const grant=await this.ctx.storage.transaction(async storage=>{
   const key=`ticket:${hashToken(ticket)}`,value=await storage.get(key);
   if(!value||value.expiresAt<=Date.now())return null;
   await storage.delete(key);return value;
  });
  if(!grant)return new Response('Subscription expired',{status:401});
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);
  server.serializeAttachment({memberId:grant.memberId});this.ctx.acceptWebSocket(server);
  return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'wishwheel-v1'}});
 }
 webSocketMessage(socket,message){if(message==='ping')socket.send('pong');else socket.close(1008,'Read-only notifications');}
 webSocketClose(socket,code,reason){socket.close(code,reason);}
 webSocketError(socket){try{socket.close(1011,'Reconnect');}catch{}}
 async alarm(){
  const tickets=await this.ctx.storage.list({prefix:'ticket:'});let next=Infinity;
  for(const [key,value] of tickets){if(value.expiresAt<=Date.now())await this.ctx.storage.delete(key);else next=Math.min(next,value.expiresAt);}
  if(Number.isFinite(next))await this.ctx.storage.setAlarm(next);
 }
}
