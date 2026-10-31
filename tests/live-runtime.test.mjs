import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {newToken,cleanSettings,matchAssignments} from '../server/engine.mjs';

const origin='https://wishwheel.lobbyx3.com';
test('large prelisted rooms exceed fifty and large name draws use complete non-self matching',()=>{
 const roster=Array.from({length:600},(_,index)=>`Person ${index}`);
 assert.equal(cleanSettings({participantMode:'roster',roster}).maxMembers,600);
 assert.equal(cleanSettings({maxMembers:10000}).maxMembers,10000);
 const members=Array.from({length:10000},(_,index)=>({id:String(index),name:`Person ${index}`}));
 const items=members.map(member=>({id:member.id,label:member.name,memberId:member.id}));
 for(const pool of [items,[...items,...Array.from({length:100},(_,index)=>({id:`extra-${index}`,label:`Extra gift ${index}`}))]])for(const unique of [true,false]){
  const assignments=matchAssignments(members,pool,unique);
  assert.equal(Object.keys(assignments).length,10000);if(unique)assert.equal(new Set(Object.values(assignments).map(assignment=>assignment.itemId)).size,10000);
  for(const member of members)assert.notEqual(assignments[member.id].itemId,member.id);
 }
});

test('real Workers runtime: authenticated hibernating sockets receive immediate public joins and spins, with one-use tickets', {timeout:45000},async t=>{
 const bundle=buildSync({entryPoints:[fileURLToPath(new URL('../worker/index.mjs',import.meta.url))],bundle:true,platform:'neutral',format:'esm',external:['node:*'],write:false});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'wishwheel',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],durableObjects:{ROOM_LIVE:{className:'RoomLive',useSQLite:true}},bindings:{ALLOWED_ORIGINS:origin}}]}));
 t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const migration of ['0001_rooms.sql','0002_google_sessions.sql'])await db.exec(readFileSync(new URL(`../worker/migrations/${migration}`,import.meta.url),'utf8').replace(/^--.*$/gm,'').replace(/\n/g,' '));
 const owner=newToken(),guest=newToken();
 async function call(path,body,token){const response=await mf.dispatchFetch(`https://wishwheel.test${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
 const created=await call('/api/room',{action:'create',name:'Alice',settings:{poolMode:'custom',items:['Secret gift alpha','Secret gift beta'],wheelHidden:true,turnBased:false}},owner);
 assert.equal(created.status,200);const code=created.body.room.code;
 const denied=await call('/api/live-ticket',{code},newToken());assert.equal(denied.status,401);
 const issued=await call('/api/live-ticket',{code},owner);assert.equal(issued.status,200);
 const upgrade={headers:{Origin:origin,Upgrade:'websocket','Sec-WebSocket-Protocol':`wishwheel-v1, ${issued.body.ticket}`}};
 const connected=await mf.dispatchFetch(`https://wishwheel.test/api/live?code=${code}`,upgrade);
 assert.equal(connected.status,101);const socket=connected.webSocket;socket.accept();t.after(()=>socket.close(1000));
 const reused=await mf.dispatchFetch(`https://wishwheel.test/api/live?code=${code}`,upgrade);assert.equal(reused.status,401);
 function notice(kind){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.removeEventListener('message',receive);reject(new Error(`No ${kind} notification`));},3000);const receive=event=>{const value=JSON.parse(event.data);if(value.kind===kind){clearTimeout(timer);socket.removeEventListener('message',receive);resolve(value);}};socket.addEventListener('message',receive);});}
 const joining=notice('join');await call('/api/room',{action:'join',code,name:'Bob'},guest);const joined=await joining;
 assert.equal(joined.member.name,'Bob');assert.equal(joined.member.status,'waiting');
 await call('/api/room',{action:'start',code,generation:1},owner);
 const spinning=notice('spin'),picked=await call('/api/room',{action:'spin',code,generation:1},guest);assert.equal(picked.status,200);
 const event=await spinning;assert.equal(event.member.status,'picking');assert.ok(event.version>joined.version);
 assert.ok(!JSON.stringify(event).match(/Secret gift|result|itemId|assignment|tokenHash/));
 const reset=notice('reset');await call('/api/room',{action:'reset',code,generation:1},owner);assert.equal((await reset).generation,2);
});
