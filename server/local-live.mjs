import {WebSocketServer} from 'ws';
import {hashToken,newToken} from './engine.mjs';
import {LIVE_TICKET_MS,publicRoomEvent,ticketFromProtocols} from './live.mjs';

export function attachLocalLive(server){
 const tickets=new Map(),sockets=new WebSocketServer({noServer:true,handleProtocols:()=> 'wishwheel-v1'});
 server.on('upgrade',(request,socket,head)=>{
  const url=new URL(request.url,'http://localhost'),origin=request.headers.origin;
  if(url.pathname!=='/api/live'||origin&&!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  const raw=ticketFromProtocols(request.headers['sec-websocket-protocol']),hash=raw&&hashToken(raw),grant=tickets.get(hash);tickets.delete(hash);
  if(!grant||grant.code!==url.searchParams.get('code')||grant.expiresAt<=Date.now()){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return;}
  sockets.handleUpgrade(request,socket,head,client=>{
   client.roomCode=grant.code;client.memberId=grant.memberId;
   client.on('error',()=>{});client.on('message',data=>{if(String(data)==='ping')client.send('pong');else client.close(1008,'Read-only notifications');});
  });
 });
 return {
  issue(result){
   const now=Date.now();for(const [key,ticket] of tickets)if(ticket.expiresAt<=now)tickets.delete(key);
   const ticket=newToken(),expiresAt=now+LIVE_TICKET_MS;
   tickets.set(hashToken(ticket),{code:result.room.code,memberId:result.me.id,expiresAt});return {ticket,expiresAt};
  },
  notify(result,input){
   const event=JSON.stringify(publicRoomEvent(result,input.action)),members=new Set(result.room.members.map(member=>member.id));
   const slot=result.invitations?.find(slot=>slot.id===input.slotId),revoked=input.action==='regenerate-invite'?result.room.members.find(member=>member.name===slot?.name)?.id:null;
   for(const client of sockets.clients)if(client.roomCode===result.room.code){
    if(!members.has(client.memberId)||client.memberId===revoked){client.close(1008,'Membership changed');continue;}
    if(client.readyState===1)client.send(event);
   }
  },
 };
}
