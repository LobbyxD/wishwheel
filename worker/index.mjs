import { createHandler } from '../server/http.mjs';
import { D1Store } from '../server/store.mjs';
import { AppError } from '../server/engine.mjs';
import {handleAuth,readAccount} from '../server/google-auth.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function error(status,code,message) { return Response.json({error:{code,message}},{status,headers}); }
async function handle(request,env,createStore,verifyGoogle) {
  const url=new URL(request.url);
  if(url.pathname!=='/api/room'&&!url.pathname.startsWith('/api/auth/')) return error(404,'NOT_FOUND','Not found.');
  // Explicit public frontend origins, never X-Forwarded-Host or a suffix match.
  const origins=String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!origins.length) return error(503,'NOT_CONFIGURED','The room service is not configured yet. Please try again later.');
  const origin=request.headers.get('Origin');
  if(origin && !origins.includes(origin)) return error(403,'ORIGIN_REJECTED','This request must come from Wishwheel.');
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
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
  await createHandler(()=>store,account)(req,res);
  return Response.json(res.value,{status:res.statusCode,headers:res.headers});
}
export function createWorker(createStore=env=>new D1Store(env.DB),verifyGoogle){return {
 async fetch(request,env) {
  let response;
  try{response=await handle(request,env,createStore,verifyGoogle);}catch(cause){response=cause instanceof AppError?error(cause.status,cause.code,cause.message):error(503,'SERVICE_UNAVAILABLE','The room service is temporarily unavailable. Please retry.');}
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
