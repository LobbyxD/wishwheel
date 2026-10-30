// Explicit local-only integration harness. Not imported by production API.
// Start: WISHWHEEL_TEST_MODE=1 node server/dev.mjs
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {LocalFileStore} from './local-store.mjs';
import { roomService } from './service.mjs';
import { AppError, createRoom, joinRoom, hashToken } from './engine.mjs';
if(process.env.WISHWHEEL_TEST_MODE!=='1') throw new Error('Set WISHWHEEL_TEST_MODE=1 explicitly. Test data is temporary and local only.');
class TestMemoryStore {
 constructor(){this.records=new Map();}
 async byOwner(hash){return structuredClone([...this.records.values()].find(r=>r.ownerHash===hash)||null);}
 async read(code){return structuredClone(this.records.get(code)||null);}
 async insert(state,ownerHash){if(this.records.has(state.code)||[...this.records.values()].some(r=>r.ownerHash===ownerHash))throw new AppError('CONFLICT','collision',409);this.records.set(state.code,{state:structuredClone(state),ownerHash,revision:1});}
 async cas(code,revision,state){const r=this.records.get(code);if(r.revision!==revision)return false;this.records.set(code,{...r,revision:revision+1,state:structuredClone(state)});return true;}
}
const temporary=process.env.WISHWHEEL_VOLATILE==='1'||process.env.WISHWHEEL_QA_FIXTURES==='1';
const dataDirectory=process.env.WISHWHEEL_DATA_DIR||fileURLToPath(new URL('../.wishwheel/',import.meta.url));
const store=temporary?new TestMemoryStore():new LocalFileStore(dataDirectory);
if(process.env.WISHWHEEL_QA_FIXTURES==='1') {
 const tokens=['A'.repeat(43),'B'.repeat(43),'C'.repeat(43)];
 const fixture=createRoom('Daniel QA',{title:'QA Christmas wishes',maxMembers:3,poolMode:'names',turnBased:true,removePicked:true},hashToken(tokens[0]),'QA2ABC');
 joinRoom(fixture,'Ron QA',hashToken(tokens[1]));joinRoom(fixture,'Luna QA',hashToken(tokens[2]));
 await store.insert(fixture,hashToken(tokens[0]));
 console.log('TEMPORARY TEST FIXTURE: room QA2ABC. Fake local-only tokens:');
 ['Daniel QA','Ron QA','Luna QA'].forEach((name,index)=>console.log(name+': '+tokens[index]));
}

const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(!req.url.startsWith('/api/room')){res.writeHead(404);res.end('{}');return;}
 try {
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>450000)throw new AppError('TOO_LARGE','Too large',413);}
  const url=new URL(req.url,'http://localhost:3001');
  const input=req.method==='GET'?{action:'state',code:url.searchParams.get('code')}:JSON.parse(raw);
  const token=req.headers.authorization?.replace(/^Bearer /,'');
  const result=await roomService(store,input,token);res.writeHead(200);res.end(JSON.stringify(result));
 }catch(error){
  const expected=error instanceof AppError;
  if(!expected)console.error('Local room request failed:',error.message);
  res.writeHead(expected?error.status:500);res.end(JSON.stringify({error:{code:expected?error.code:'SERVICE_UNAVAILABLE',message:expected?error.message:'Local room storage is unavailable. Check the server console.'}}));
 }
});
server.on('error',error=>{
 if(error.code==='EADDRINUSE'){
  console.log('API port 3001 is busy; choosing an available local port.');
  server.listen(0,'127.0.0.1');
 }else{
  console.error(`Wishwheel API could not start: ${error.message}`);
  process.exit(1);
 }
});
server.once('listening',()=>{
 const {port}=server.address();
 console.log(`Wishwheel LOCAL API at http://127.0.0.1:${port}; ${temporary?'data is temporary.':`rooms saved in ${dataDirectory}`}`);
 process.send?.({type:'ready',port});
});
// Do not leave the temporary API running if its launcher exits unexpectedly.
process.on('disconnect',()=>process.exit(0));
server.listen(3001,'127.0.0.1');
