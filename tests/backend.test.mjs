import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError,createRoom,joinRoom,mutateRoom,serializeRoom,hashToken,newToken,newCode,matchAssignments,normalize,cleanSettings } from '../server/engine.mjs';
import { roomService } from '../server/service.mjs';

const owner=newToken(),guest=newToken(),third=newToken();
const settings={title:'Winter wishes',maxMembers:8,poolMode:'names',removePicked:true,turnBased:false};
function roomWithNames(names=['Daniel','Ron','Luna']) {
 const tokens=[owner,guest,third,...Array.from({length:50},newToken)];
 const room=createRoom(names[0],settings,hashToken(tokens[0]),'AB23CD',100);
 names.slice(1).forEach((name,i)=>joinRoom(room,name,hashToken(tokens[i+1]),101+i));
 return {room,tokens};
}
class MemoryStore {
 constructor(){this.records=new Map();}
 async byOwner(hash){return structuredClone([...this.records.values()].find(r=>r.ownerHash===hash)||null);}
 async read(code){return structuredClone(this.records.get(code)||null);}
 async insert(state,ownerHash){
  if(this.records.has(state.code)||[...this.records.values()].some(r=>r.ownerHash===ownerHash)) throw new AppError('CONFLICT','collision',409);
  this.records.set(state.code,{state:structuredClone(state),ownerHash,revision:1});
 }
 async cas(code,revision,state){const r=this.records.get(code);if(r.revision!==revision)return false;this.records.set(code,{...r,revision:revision+1,state:structuredClone(state)});return true;}
}

test('codes are six characters with both letters and digits',()=>{for(let i=0;i<1000;i++){const code=newCode();assert.match(code,/^[A-Z2-9]{6}$/);assert.match(code,/[A-Z]/);assert.match(code,/[2-9]/);}});
test('normalization prevents duplicate and self names',()=>{
 const {room}=roomWithNames(['Daniel','Ron']);
 assert.throws(()=>joinRoom(room,' ＤＡＮＩＥＬ ',hashToken(third)),{code:'NAME_TAKEN'});
 assert.equal(normalize('  RON '),'ron');
});
test('settings reject duplicate custom items and unsafe cover URLs',()=>{
 assert.throws(()=>cleanSettings({...settings,poolMode:'custom',items:['A',' a ']}),{code:'DUPLICATE_ITEMS'});
 assert.throws(()=>cleanSettings({...settings,coverImage:'https://tracker.test/a.png'}),{code:'INVALID_IMAGE'});
 assert.throws(()=>cleanSettings({...settings,coverImage:'data:image/svg+xml;base64,AAA'}),{code:'INVALID_IMAGE'});
});
test('matching is complete and no-self/no-repeat across sizes and many random seeds',()=>{
 for(let size=2;size<=50;size++)for(let iteration=0;iteration<25;iteration++){
  const members=Array.from({length:size},(_,i)=>({id:`p${i}`,name:`Person ${i}`}));
  const items=members.map(m=>({id:m.id,label:m.name,memberId:m.id}));
  const assignments=matchAssignments(members,items,true);
  assert.equal(new Set(Object.values(assignments).map(a=>a.itemId)).size,size);
  for(const member of members)assert.notEqual(assignments[member.id].itemId,member.id);
 }
});
test('impossible pool fails before start with no partial assignment',()=>{
 const {room}=roomWithNames();room.settings.poolMode='custom';room.settings.items=['one','two'];
 assert.throws(()=>mutateRoom(room,'start',hashToken(owner),1),{code:'NOT_ENOUGH_ITEMS'});
 assert.equal(room.phase,'lobby');
});
test('canonical custom self labels are excluded even with repeats',()=>{
 const members=[{id:'a',name:'Daniel'},{id:'b',name:'Ron'}];
 for(let i=0;i<100;i++){
  const assignments=matchAssignments(members,[{id:'a',label:' DANIEL '},{id:'b',label:'ron'}],false);
  assert.equal(assignments.a.itemId,'b');assert.equal(assignments.b.itemId,'a');
 }
});
test('repeat mode can reuse items but never a self item',()=>{
 const assignments=matchAssignments([{id:'a',name:'Daniel'},{id:'b',name:'Ron'}],[{id:'x',label:'Chocolate'}],false);
 assert.equal(assignments.a.itemId,'x');assert.equal(assignments.b.itemId,'x');
});
test('host sees only own result, never tokens or others assignments',()=>{
 const {room}=roomWithNames();mutateRoom(room,'start',hashToken(owner),1,200);
 mutateRoom(room,'spin',hashToken(guest),1,300);
 const visible=serializeRoom(room,hashToken(owner),7000);
 assert.equal(visible.me.result,null);
 const serialized=JSON.stringify(visible);
 assert.ok(!serialized.includes('tokenHash'));assert.ok(!serialized.includes('assignments'));assert.ok(!serialized.includes('pickedAt'));
 assert.equal(visible.room.members.find(m=>m.id===room.members[1].id).status,'picked');
});
test('hidden pool omits labels and guest custom list before result',()=>{
 const {room}=roomWithNames(['Daniel','Ron']);
 room.settings.poolMode='custom';room.settings.items=['Secret chocolate','Secret book'];room.settings.wheelHidden=true;
 mutateRoom(room,'start',hashToken(owner),1,200);
 const visible=serializeRoom(room,hashToken(guest),300);
 assert.deepEqual(visible.room.settings.items,[]);assert.ok(visible.wheelItems.every(item=>item.label==='?'));
 assert.ok(!JSON.stringify(visible).includes('Secret'));
});
test('spin is idempotent and reset rejects stale spin',()=>{
 const {room}=roomWithNames();mutateRoom(room,'start',hashToken(owner),1,200);
 mutateRoom(room,'spin',hashToken(guest),1,300);const first=structuredClone(room.assignments[room.members[1].id]);
 mutateRoom(room,'spin',hashToken(guest),1,400);assert.deepEqual(room.assignments[room.members[1].id],first);
 mutateRoom(room,'reset',hashToken(owner),1,500);
 assert.equal(room.generation,2);assert.equal(room.phase,'lobby');assert.deepEqual(room.assignments,{});
 assert.throws(()=>mutateRoom(room,'spin',hashToken(guest),1,600),{code:'STALE_GENERATION'});
});
test('random turn lease advances without client finish callback',()=>{
 const {room,tokens}=roomWithNames();room.settings.turnBased=true;mutateRoom(room,'start',hashToken(owner),1,200);
 const firstId=room.turnOrder[0],secondId=room.turnOrder[1];
 const firstToken=tokens[room.members.findIndex(m=>m.id===firstId)],secondToken=tokens[room.members.findIndex(m=>m.id===secondId)];
 assert.throws(()=>mutateRoom(room,'spin',hashToken(secondToken),1,300),{code:'NOT_YOUR_TURN'});
 mutateRoom(room,'spin',hashToken(firstToken),1,300);
 assert.equal(serializeRoom(room,hashToken(owner),400).room.turnMemberId,firstId);
 assert.equal(serializeRoom(room,hashToken(owner),6301).room.turnMemberId,secondId);
 mutateRoom(room,'spin',hashToken(secondToken),1,6301);
});
test('non-owner cannot start/reset and invalid token cannot view room',()=>{
 const {room}=roomWithNames();
 assert.throws(()=>mutateRoom(room,'start',hashToken(guest),1),{code:'OWNER_ONLY'});
 assert.throws(()=>mutateRoom(room,'reset',hashToken(guest),1),{code:'OWNER_ONLY'});
 assert.throws(()=>serializeRoom(room,hashToken(newToken())),{code:'SESSION_REQUIRED'});
});
test('room capacity/start boundaries and duplicate request recovery',async()=>{
 const store=new MemoryStore();const create={action:'create',name:'Daniel',settings:{...settings,maxMembers:2}};
 const a=await roomService(store,create,owner,100);const retry=await roomService(store,create,owner,101);
 assert.equal(a.room.code,retry.room.code);assert.equal(store.records.size,1);
 const code=a.room.code;
 const results=await Promise.allSettled([
  roomService(store,{action:'join',code,name:'Ron'},guest,200),
  roomService(store,{action:'join',code,name:'Luna'},third,200)
 ]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'ROOM_FULL');
 assert.equal((await store.read(code)).state.members.length,2);
 await roomService(store,{action:'start',code,generation:1},owner,300);
 await assert.rejects(()=>roomService(store,{action:'join',code,name:'Other'},newToken(),400),{code:'ROOM_STARTED'});
});
test('concurrent spins and duplicate retries preserve unique assignments',async()=>{
 const store=new MemoryStore();const a=await roomService(store,{action:'create',name:'Daniel',settings},owner,100);const code=a.room.code;
 await roomService(store,{action:'join',code,name:'Ron'},guest,101);await roomService(store,{action:'join',code,name:'Luna'},third,102);
 await roomService(store,{action:'start',code,generation:1},owner,200);
 const requests=[owner,guest,third,owner,guest,third].map(token=>roomService(store,{action:'spin',code,generation:1},token,300));
 const results=await Promise.all(requests);
 assert.equal(results[0].me.result.id,results[3].me.result.id);assert.equal(results[1].me.result.id,results[4].me.result.id);
 assert.equal(new Set(results.slice(0,3).map(r=>r.me.result.id)).size,3);
 const finished=await roomService(store,{action:'state',code},owner,7000);assert.equal(finished.room.phase,'complete');
});
test('concurrent reset wins over stale-generation mutation',async()=>{
 const store=new MemoryStore();const a=await roomService(store,{action:'create',name:'Daniel',settings},owner,100);const code=a.room.code;
 await roomService(store,{action:'join',code,name:'Ron'},guest,101);await roomService(store,{action:'start',code,generation:1},owner,200);
 await roomService(store,{action:'reset',code,generation:1},owner,300);
 await assert.rejects(()=>roomService(store,{action:'spin',code,generation:1},guest,301),{code:'STALE_GENERATION'});
 assert.equal((await store.read(code)).state.phase,'lobby');
});
test('mixed pool adds member names, dedupes custom labels, and never self-matches',()=>{
 const {room}=roomWithNames(['Daniel','Ron']);room.settings.poolMode='mixed';room.settings.items=['Chocolate',' daniel '];
 mutateRoom(room,'start',hashToken(owner),1,200);
 assert.equal(room.items.length,3);assert.equal(room.items.filter(item=>normalize(item.label)==='daniel').length,1);
 for(const member of room.members)assert.notEqual(normalize(room.items.find(item=>item.id===room.assignments[member.id].itemId).label),normalize(member.name));
});
