import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createRoom,joinRoom,mutateRoom,serializeRoom,previewRoom,cleanSettings,hashToken,newToken,issueInvitationCodes} from '../server/engine.mjs';
import {roomService} from '../server/service.mjs';
import {LocalFileStore} from '../server/local-store.mjs';

const tokens=[newToken(),newToken(),newToken(),newToken()];
const hashes=tokens.map(hashToken);
const issued=new WeakMap();
function listed(){const room=createRoom('Alice',{participantMode:'roster',roster:['Alice','Bob','Carol'],turnBased:false},hashes[0],'AB23CD',100);issued.set(room,issueInvitationCodes(room,hashes[0]));return room;}
function personCode(room,name){return issued.get(room)?.find(person=>person.name.toLowerCase()===name.trim().toLowerCase())?.code||'';}
function joinListed(room,name,hash,now=Date.now(),account=null){return joinRoom(room,name,hash,now,personCode(room,name),account);}
async function storage(t){const directory=await mkdtemp(path.join(os.tmpdir(),'wishwheel-rooms-'));t.after(async()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(directory).startsWith('wishwheel-rooms-'));await rm(directory,{recursive:true,force:true});});return {directory,store:new LocalFileStore(directory)};}

test('prelisted rooms validate names, uniqueness, host membership and derived capacity',()=>{
 assert.throws(()=>cleanSettings({participantMode:'roster',roster:['Alice']}),{code:'INVALID_ROSTER'});
 assert.throws(()=>cleanSettings({participantMode:'roster',roster:['Alice',' ＡＬＩＣＥ ']}),{code:'INVALID_ROSTER'});
 assert.throws(()=>createRoom('Other',{participantMode:'roster',roster:['Alice','Bob']},hashes[0]),{code:'NOT_LISTED'});
 assert.equal(listed().settings.maxMembers,3);
 const room=listed();joinListed(room,' bob ',hashes[1]);assert.equal(room.members[1].name,'Bob');
 assert.throws(()=>joinListed(room,'Other',hashes[2]),{code:'PERSONAL_CODE_REQUIRED'});
});

test('invitation preview requires a private code without listing names, capabilities, results or member IDs',()=>{
 const room=listed(),preview=previewRoom(room);
 assert.deepEqual(preview.people,[]);assert.equal(preview.requiresPersonalCode,true);
 const json=JSON.stringify(preview);
 for(const secret of [room.ownerId,hashes[0],'token','assignments','result'])assert.ok(!json.includes(secret));
 joinListed(room,'Bob',hashes[1]);joinListed(room,'Carol',hashes[2]);mutateRoom(room,'start',hashes[0],1,200);
 assert.deepEqual(previewRoom(room).people,[]);
});

test('private person codes fix the identity before start and the complete-roster rule remains enforced',()=>{
 const room=listed();joinListed(room,'Bob',hashes[1]);
 assert.throws(()=>mutateRoom(room,'start',hashes[0],1,200),{code:'ROSTER_INCOMPLETE'});
 assert.throws(()=>mutateRoom(room,'identify',hashes[1],1,201,{name:'Carol'}),{code:'PERSONAL_IDENTITY_LOCKED'});
 assert.equal(room.members[1].name,'Bob');
 joinListed(room,'Carol',hashes[2]);mutateRoom(room,'start',hashes[0],1,203);
 assert.throws(()=>mutateRoom(room,'identify',hashes[1],1,204,{name:'Carol'}),{code:'PERSONAL_IDENTITY_LOCKED'});
 mutateRoom(room,'reset',hashes[0],1,300);assert.equal(room.phase,'lobby');assert.equal(room.members[1].name,'Bob');
});

test('concurrent claims cannot take the same prelisted name',async t=>{
 const {store}=await storage(t);const room=listed();await store.insert(room,hashes[0]);
 const results=await Promise.allSettled([
  roomService(store,{action:'join',code:room.code,name:'Bob',inviteCode:personCode(room,'Bob')},tokens[1],Date.now(),{id:'google:first',provider:'google'}),
  roomService(store,{action:'join',code:room.code,name:' bob ',inviteCode:personCode(room,'Bob')},tokens[2],Date.now(),{id:'google:second',provider:'google'})
 ]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 const saved=await store.read(room.code);
 assert.equal(saved.state.members.filter(member=>member.name==='Bob').length,1);
});

test('only the host can kick, and kicking revokes access while freeing a roster place',()=>{
 const room=listed();joinListed(room,'Bob',hashes[1]);
 assert.throws(()=>mutateRoom(room,'kick',hashes[1],1,200,{memberId:room.ownerId}),{code:'OWNER_ONLY'});
 assert.throws(()=>mutateRoom(room,'kick',hashes[0],1,200,{memberId:room.ownerId}),{code:'CANNOT_KICK_HOST'});
 const kicked=room.members[1].id;
 mutateRoom(room,'kick',hashes[0],1,201,{memberId:kicked});
 assert.equal(room.members.length,1);assert.equal(room.generation,2);
 assert.throws(()=>serializeRoom(room,hashes[1]),{code:'REMOVED'});
 assert.throws(()=>joinListed(room,'Bob',hashes[1]),{code:'REMOVED'});
 assert.equal(serializeRoom(room,hashes[0]).invitations.find(person=>person.name==='Bob').claimed,false);
 assert.ok(!JSON.stringify(serializeRoom(room,hashes[0])).includes('revokedTokenHashes'));
 mutateRoom(room,'kick',hashes[0],2,202,{memberId:kicked});assert.equal(room.generation,2);
 issued.set(room,issueInvitationCodes(room,hashes[0]));joinListed(room,'Bob',hashes[3]);assert.equal(room.members[1].name,'Bob');
});

test('kicking during a round clears results, returns items and rejects stale spins',()=>{
 const room=listed();joinListed(room,'Bob',hashes[1]);joinListed(room,'Carol',hashes[2]);mutateRoom(room,'start',hashes[0],1,200);
 mutateRoom(room,'spin',hashes[2],1,201);
 mutateRoom(room,'kick',hashes[0],1,202,{memberId:room.members[1].id});
 const state=serializeRoom(room,hashes[2],203);
 assert.equal(state.room.phase,'lobby');assert.equal(state.me.result,null);assert.equal(state.room.generation,2);
 assert.deepEqual(room.assignments,{});assert.deepEqual(room.items,[]);assert.deepEqual(room.turnOrder,[]);
 assert.throws(()=>mutateRoom(room,'spin',hashes[2],1,204),{code:'STALE_GENERATION'});
});

test('a concurrent kick and spin cannot leave a partial round',async t=>{
 const {store}=await storage(t);const room=listed();joinListed(room,'Bob',hashes[1]);joinListed(room,'Carol',hashes[2]);mutateRoom(room,'start',hashes[0],1,200);await store.insert(room,hashes[0]);
 await Promise.allSettled([
  roomService(store,{action:'kick',code:room.code,generation:1,memberId:room.members[1].id},tokens[0],300),
  roomService(store,{action:'spin',code:room.code,generation:1},tokens[1],300)
 ]);
 const final=await store.read(room.code);
 assert.equal(final.state.phase,'lobby');assert.equal(final.state.members.length,2);assert.deepEqual(final.state.assignments,{});
});

test('room data, owner access and results survive storage reopening and a year of inactivity',async t=>{
 const {store,directory}=await storage(t);
 const created=await roomService(store,{action:'create',name:'Alice',settings:{turnBased:false}},tokens[0],100);
 const code=created.room.code;
 await roomService(store,{action:'join',code,name:'Bob'},tokens[1],101);
 await roomService(store,{action:'start',code,generation:1},tokens[0],102);
 const picked=await roomService(store,{action:'spin',code,generation:1},tokens[0],103);
 const reopened=new LocalFileStore(directory),year=366*24*60*60*1000;
 const returned=await roomService(reopened,{action:'state',code},tokens[0],year);
 assert.equal(returned.me.isOwner,true);assert.deepEqual(returned.me.result,picked.me.result);
 const reset=await roomService(reopened,{action:'reset',code,generation:1},tokens[0],year+1);
 assert.equal(reset.room.code,code);assert.equal(reset.room.phase,'lobby');assert.equal(reset.room.members.length,2);assert.equal(reset.room.generation,2);
 const disk=JSON.parse(await readFile(path.join(directory,'rooms.json'),'utf8'));
 assert.ok(!JSON.stringify(disk).includes(tokens[0]));assert.equal(disk.records[code].state.generation,2);
});

test('local storage refuses to overwrite corrupted room data',async t=>{
 const {store,directory}=await storage(t);const file=path.join(directory,'rooms.json');
 await writeFile(file,'not valid json');
 await assert.rejects(store.insert(listed(),hashes[0]));
 assert.equal(await readFile(file,'utf8'),'not valid json');
});

async function bootApi(directory){
 const child=spawn(process.execPath,['server/dev.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WISHWHEEL_TEST_MODE:'1',WISHWHEEL_VOLATILE:'0',WISHWHEEL_QA_FIXTURES:'0',WISHWHEEL_DATA_DIR:directory},stdio:['ignore','ignore','pipe','ipc']});
 const exited=once(child,'exit');let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
 async function stop(){if(child.exitCode===null&&child.signalCode===null)child.kill();await exited;}
 try{
  const port=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error(`Local API startup timeout: ${errors}`)),5000);
   child.once('message',message=>{clearTimeout(timeout);resolve(message.port);});
   child.once('exit',()=>{clearTimeout(timeout);reject(new Error(`Local API exited: ${errors}`));});
   child.once('error',error=>{clearTimeout(timeout);reject(error);});
  });
  return {base:`http://127.0.0.1:${port}`,stop};
 }catch(error){await stop();throw error;}
}

test('real API restart retains a prelisted room, private results and owner kick authority',{timeout:20000},async t=>{
 const {directory}=await storage(t);let api=await bootApi(directory);
 async function post(action,token,data={}){
  const response=await fetch(`${api.base}/api/room`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...data})});
  return {status:response.status,body:await response.json()};
 }
 try{
  const created=await post('create',tokens[0],{name:'Alice',settings:{participantMode:'roster',roster:['Alice','Bob'],turnBased:false}});
  assert.equal(created.status,200);const code=created.body.room.code;
  const preview=await post('preview',null,{code});assert.equal(preview.status,200);assert.equal(preview.body.requiresPersonalCode,true);assert.deepEqual(preview.body.people,[]);
  const joined=await post('join',tokens[1],{code,name:'Bob',inviteCode:created.body.inviteCodes.find(person=>person.name==='Bob').code});assert.equal(joined.status,200);
  assert.equal((await post('start',tokens[0],{code,generation:1})).status,200);
  const spun=await post('spin',tokens[1],{code,generation:1});assert.equal(spun.status,200);
  await api.stop();api=await bootApi(directory);
  const returned=await post('state',tokens[1],{code});assert.equal(returned.status,200);assert.deepEqual(returned.body.me.result,spun.body.me.result);
  const owner=await post('state',tokens[0],{code});assert.equal(owner.body.me.isOwner,true);
  const kicked=await post('kick',tokens[0],{code,generation:1,memberId:joined.body.me.id});assert.equal(kicked.status,200);assert.equal(kicked.body.room.phase,'lobby');
  const removed=await post('state',tokens[1],{code});assert.equal(removed.status,403);assert.equal(removed.body.error.code,'REMOVED');
  assert.equal(kicked.body.invitations.find(person=>person.name==='Bob').claimed,false);
 }finally{await api.stop();}
});
