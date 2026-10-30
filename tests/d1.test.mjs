import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1Store } from '../server/store.mjs';
import { roomService } from '../server/service.mjs';
import { createRoom, hashToken, newToken } from '../server/engine.mjs';

// Run the production migration and actual SQL in SQLite. This shim adapts only
// D1's binding/result shape; it does not emulate query or concurrency semantics.
function fixture(t) {
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../worker/migrations/0001_rooms.sql',import.meta.url),'utf8'));
 t.after(()=>sqlite.close());
 const db={prepare(sql){return {bind(...args){return {
  async first(){return sqlite.prepare(sql).get(...args)||null;},
  async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
 };}};}};
 return {sqlite,a:new D1Store(db),b:new D1Store(db)};
}
const settings={title:'Test',poolMode:'names',removePicked:true,turnBased:false,maxMembers:20};

test('D1 actual SQLite: unique codes, unique owner, and stale CAS across adapter instances',async t=>{
 const {a,b,sqlite}=fixture(t), owner=newToken();
 const state=createRoom('Owner',settings,hashToken(owner),'AB23CD',100);
 await a.insert(state,hashToken(owner));
 await assert.rejects(()=>b.insert({...state,code:'EF45GH'},hashToken(owner)),{code:'CONFLICT'});
 await assert.rejects(()=>b.insert(state,hashToken(newToken())),{code:'CONFLICT'});
 const first=await a.read(state.code),second=await b.read(state.code);
 assert.equal(await a.cas(state.code,first.revision,{...first.state,generation:2}),true);
 assert.equal(await b.cas(state.code,second.revision,second.state),false);
 assert.equal((await b.read(state.code)).state.generation,2);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM wishwheel_rooms').get().n,1);
});

test('D1 concurrent same-owner create recovers one durable room',async t=>{
 const {a,b,sqlite}=fixture(t),token=newToken();
 const input={action:'create',name:'Owner',settings};
 const rooms=await Promise.all(Array.from({length:8},(_,i)=>roomService(i%2?a:b,input,token,100)));
 assert.equal(new Set(rooms.map(r=>r.room.code)).size,1);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM wishwheel_rooms').get().n,1);
});

test('D1 concurrent joins revalidate last available seat',async t=>{
 const {a,b}=fixture(t),owner=newToken();
 const {room:{code}}=await roomService(a,{action:'create',name:'Owner',settings:{...settings,maxMembers:2}},owner,100);
 const outcomes=await Promise.allSettled([roomService(a,{action:'join',code,name:'One'},newToken(),101),roomService(b,{action:'join',code,name:'Two'},newToken(),101)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'ROOM_FULL');
 assert.equal((await a.read(code)).state.members.length,2);
});

test('D1 draws for every group size 4–20: unique, non-self, retry-safe, and private',async t=>{
 const {a,b}=fixture(t);
 for(let size=4;size<=20;size++) {
  const tokens=Array.from({length:size},newToken),names=tokens.map((_,i)=>`Person ${i}`);
  const {room:{code}}=await roomService(a,{action:'create',name:names[0],settings},tokens[0],100);
  for(let i=1;i<size;i++)await roomService(b,{action:'join',code,name:names[i]},tokens[i],101);
  await roomService(a,{action:'start',code,generation:1},tokens[0],200);
  // Limit each wave to 8 contenders, within the service's bounded retry budget.
  const results=[];
  for(let offset=0;offset<size;offset+=8)results.push(...await Promise.all(tokens.slice(offset,offset+8).map((token,i)=>roomService(i%2?a:b,{action:'spin',code,generation:1},token,300))));
  assert.equal(new Set(results.map(r=>r.me.result.id)).size,size);
  for(let i=0;i<size;i++) {
   assert.notEqual(results[i].me.result.label,names[i]);
   const again=await roomService(b,{action:'spin',code,generation:1},tokens[i],301);
   assert.deepEqual(again.me.result,results[i].me.result);
   assert.ok(!JSON.stringify(again).includes('tokenHash'));
   assert.ok(!JSON.stringify(again).includes('assignments'));
  }
 }
});

test('D1 reset racing a spin cannot resurrect old-round assignments',async t=>{
 const {a,b}=fixture(t),owner=newToken(),guest=newToken();
 const {room:{code}}=await roomService(a,{action:'create',name:'Owner',settings},owner,100);
 await roomService(b,{action:'join',code,name:'Guest'},guest,101);
 await roomService(a,{action:'start',code,generation:1},owner,200);
 const outcomes=await Promise.allSettled([
  roomService(a,{action:'reset',code,generation:1},owner,300),
  roomService(b,{action:'spin',code,generation:1},guest,300)
 ]);
 assert.equal(outcomes[0].status,'fulfilled');
 if(outcomes[1].status==='rejected')assert.equal(outcomes[1].reason.code,'STALE_GENERATION');
 const saved=await b.read(code);
 assert.equal(saved.state.generation,2);assert.equal(saved.state.phase,'lobby');assert.deepEqual(saved.state.assignments,{});
 await assert.rejects(()=>roomService(b,{action:'spin',code,generation:1},guest,301),{code:'STALE_GENERATION'});
});

test('D1 atomic rate counters enforce limits across instances and expire',async t=>{
 const {a,b,sqlite}=fixture(t);
 const outcomes=await Promise.all(Array.from({length:12},(_,i)=>(i%2?a:b).rate('test',5,60)));
 assert.equal(outcomes.filter(Boolean).length,5);
 sqlite.prepare('UPDATE wishwheel_limits SET expires_at = 0').run();
 assert.equal(await a.rate('test',5,60),true);
 assert.equal(sqlite.prepare('SELECT count FROM wishwheel_limits').get().count,1);
 sqlite.prepare('UPDATE wishwheel_limits SET expires_at = 0').run();
 await b.cleanup();
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM wishwheel_limits').get().n,0);
});

test('D1 missing binding and query failures fail closed without SQL disclosure',async()=>{
 assert.throws(()=>new D1Store(),{code:'NOT_CONFIGURED'});
 const store=new D1Store({prepare(){throw new Error('secret database detail');}});
 await assert.rejects(()=>store.read('AB23CD'),error=>error.code==='SERVICE_UNAVAILABLE'&&!error.message.includes('secret'));
});
