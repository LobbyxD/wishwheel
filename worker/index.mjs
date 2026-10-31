import { createHandler } from '../server/http.mjs';
import { D1Store } from '../server/store.mjs';
import { AppError } from '../server/engine.mjs';
import {handleAuth,readAccount} from '../server/google-auth.mjs';
import {publicRoomEvent} from '../server/live.mjs';
export {RoomLive} from '../server/live.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function error(status,code,message) { return Response.json({error:{code,message}},{status,headers}); }
async function handle(request,env,createStore,verifyGoogle) {
  const url=new URL(request.url);
  if(!['/api/room','/api/live','/api/live-ticket'].includes(url.pathname)&&!url.pathname.startsWith('/api/auth/')) return error(404,'NOT_FOUND','Not found.');
  // Explicit public frontend origins, never X-Forwarded-Host or a suffix match.
  const origins=String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!origins.length) return error(503,'NOT_CONFIGURED','The room service is not configured yet. Please try again later.');
  const origin=request.headers.get('Origin');
  if(origin && !origins.includes(origin)) return error(403,'ORIGIN_REJECTED','This request must come from Wishwheel.');
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
  if(url.pathname==='/api/live'){
   if(!env.ROOM_LIVE)return error(503,'LIVE_UNAVAILABLE','Live updates are unavailable.');
   const code=url.searchParams.get('code');if(!/^[A-Z2-9]{6}$/.test(code||''))return error(400,'INVALID_CODE','Invalid room.');
   const live=await env.ROOM_LIVE.get(env.ROOM_LIVE.idFromName(code)).fetch(request);
   return live.status===101?live:new Response(live.body,live);
  }
  const store=createStore(env);
  if(url.pathname.startsWith('/api/auth/'))return handleAuth(request,{...env,APP_ORIGIN:origin||origins[0]},store,verifyGoogle);
  const account=await readAccount(request,store);
  let body;
  if(request.method==='POST') {
   if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return error(415,'INVALID_BODY','Send JSON request data.');
   // Bound the actual stream, not just a caller-controlled Content-Length.
   const reader=request.body?.getReader();let bytes=0;const chunks=[];
   try {
    if(reader) for(;;) {const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>450000){await reader.cancel();return error(413,'TOO_LARGE','That request is too large.');}chunks.push(value);}
    const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
    body=new TextDecoder().decode(buffer);
   } catch {return error(400,'INVALID_BODY','Invalid room request.');}
  }
  // CF sets CF-Connecting-IP. Never trust client-supplied forwarded headers.
  const req={method:request.method,query:{code:url.searchParams.get('code')},body,headers:{
   host:origin?new URL(origin).host:new URL(origins[0]).host,
   origin,
   'content-type':request.headers.get('Content-Type'),
   authorization:request.headers.get('Authorization'),
   'x-forwarded-for':request.headers.get('CF-Connecting-IP')||'unknown'
  }};
  const res={headers:{...headers},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(value){this.value=value;return this;}};
  if(url.pathname==='/api/live-ticket'){
   if(request.method!=='POST')return error(405,'METHOD_NOT_ALLOWED','Use POST.');
   if(!env.ROOM_LIVE)return error(503,'LIVE_UNAVAILABLE','Live updates are unavailable.');
   let input;try{input=JSON.parse(body);}catch{return error(400,'INVALID_BODY','Invalid room.');}
   req.body=JSON.stringify({action:'state',code:input?.code});
   await createHandler(()=>store,account)(req,res);
   if(res.statusCode!==200)return Response.json(res.value,{status:res.statusCode,headers:res.headers});
   const room=res.value.room,live=env.ROOM_LIVE.get(env.ROOM_LIVE.idFromName(room.code));
   const ticket=await live.fetch(new Request('https://room/issue',{method:'POST',body:JSON.stringify({memberId:res.value.me.id})}));
   return new Response(ticket.body,{status:ticket.status,headers:{...headers,'Content-Type':'application/json'}});
  }
  await createHandler(()=>store,account,env.ROOM_LIVE?async(result,input)=>{
   const slot=result.invitations?.find(slot=>slot.id===input.slotId),revoked=input.action==='regenerate-invite'?result.room.members.find(member=>member.name===slot?.name)?.id:null;
   await env.ROOM_LIVE.get(env.ROOM_LIVE.idFromName(result.room.code)).fetch(new Request('https://room/notify',{method:'POST',body:JSON.stringify({event:publicRoomEvent(result,input.action),memberIds:result.room.members.map(member=>member.id),revokeMemberId:revoked})}));
  }:null)(req,res);
  return Response.json(res.value,{status:res.statusCode,headers:res.headers});
}
export function createWorker(createStore=env=>new D1Store(env.DB),verifyGoogle){return {
 async fetch(request,env) {
  let response;
  try{response=await handle(request,env,createStore,verifyGoogle);}catch(cause){response=cause instanceof AppError?error(cause.status,cause.code,cause.message):error(503,'SERVICE_UNAVAILABLE','The room service is temporarily unavailable. Please retry.');}
  if(response.status===101)return response;
  const origin=request.headers.get('Origin');
  if(origin && String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin)) {
   response.headers.set('Access-Control-Allow-Origin',origin);
  }
  response.headers.set('Vary','Origin, Authorization, Cookie');
  return response;
 },
 async scheduled(_event,env,ctx) {ctx.waitUntil(createStore(env).cleanup());}
};}
export default createWorker();
