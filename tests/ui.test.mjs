import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {createElement, Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoom, joinRoom, mutateRoom, serializeRoom, hashToken, newToken, cleanSettings, issueInvitationCodes} from '../server/engine.mjs';

// Compile the actual TSX components in memory and share React with the renderer.
async function loadSource(path) {
 const result = buildSync({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
 const source = result.outputFiles[0].text.replace(/from "(react(?:\/[^" ]+)?|lucide-react)"/g,(_,name)=>`from ${JSON.stringify(import.meta.resolve(name))}`);
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {default:Wheel} = await loadSource('../src/Wheel.tsx');
const {TurnBanner,GuestList} = await loadSource('../src/RoomProgress.tsx');
const {prepareCoverImage} = await loadSource('../src/cover-image.ts');
const {default:HomePage} = await loadSource('../src/HomePage.tsx');
const {default:FestiveAtmosphere} = await loadSource('../src/FestiveAtmosphere.tsx');
const {attachPointerMagic} = await loadSource('../src/PointerMagic.tsx');
const roomMemory = await loadSource('../src/api.ts');
const {sliceArcs,interpolateSlices} = await loadSource('../src/useAnimatedSlices.ts');
const {default:RoomLibrary} = await loadSource('../src/RoomLibrary.tsx');
const {RoomIdentity} = await loadSource('../src/RosterFields.tsx');

for (const count of [1,2,3,12,50]) test(`image wheel has ${count} independent, clipped slices and hides their labels`,()=>{
 const items=Array.from({length:count},(_,index)=>({id:String(index),label:`Secret item ${index}`}));
 const html=renderToStaticMarkup(createElement(Wheel,{items,hidden:true,spinning:false,result:null,settings:{coverType:'image',coverImage:'/assets/holiday-scene.webp'}}));
 assert.equal((html.match(/data-wheel-slice=/g)||[]).length,count);
 assert.equal((html.match(/<image /g)||[]).length,count);
 assert.equal((html.match(/<clipPath /g)||[]).length,count);
 assert.ok(!html.includes('Secret item'));
 const clips=[...html.matchAll(/clip-path="url\(#([^)]*)\)"/g)].map(match=>match[1]);
 assert.equal(new Set(clips).size,count);
 for(const id of clips)assert.ok(html.includes(`id="${id}"`));
});

test('two wheels on the same page have independent clip IDs',()=>{
 const props={items:[{id:'a',label:'A'},{id:'b',label:'B'}],hidden:true,spinning:false,result:null,settings:{coverType:'image'}};
 const html=renderToStaticMarkup(createElement(Fragment,null,createElement(Wheel,props),createElement(Wheel,props)));
 const ids=[...html.matchAll(/<clipPath id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
});

test('public turn UI follows ready, picking, picked, next turn, completion and reset without results',()=>{
 const tokens=[newToken(),newToken(),newToken()];
 const room=createRoom('Alice',{turnBased:true,poolMode:'custom',items:['Secret book','Secret cocoa','Secret bell']},hashToken(tokens[0]));
 joinRoom(room,'Bob',hashToken(tokens[1]));joinRoom(room,'Carol',hashToken(tokens[2]));
 mutateRoom(room,'start',hashToken(tokens[0]),1,200);
 room.turnOrder=room.members.map(member=>member.id);
 function render(now){
  const state=serializeRoom(room,hashToken(tokens[0]),now);
  const html=renderToStaticMarkup(createElement(Fragment,null,createElement(TurnBanner,{state}),createElement(GuestList,{state,onRefresh(){}})));
  assert.ok(!html.includes('Secret'));
  assert.ok(!html.includes('tokenHash'));assert.ok(!html.includes('assignments'));
  return {state,html};
 }
 let view=render(250);
 assert.deepEqual(view.state.room.turnOrder,room.turnOrder);
 assert.match(view.html,/It’s your turn!/);assert.match(view.html,/Up next/);assert.match(view.html,/aria-current="step"/);
 mutateRoom(room,'spin',hashToken(tokens[0]),1,300);
 view=render(400);assert.match(view.html,/status-picking/);assert.match(view.html,/Making magic/);
 view=render(6301);assert.match(view.html,/status-picked/);assert.equal(view.state.room.turnMemberId,room.members[1].id);assert.match(view.html,/1 \/ 3 picked/);
 mutateRoom(room,'spin',hashToken(tokens[1]),1,6301);
 mutateRoom(room,'spin',hashToken(tokens[2]),1,12302);
 view=render(18303);assert.equal(view.state.room.phase,'complete');assert.match(view.html,/3 \/ 3 picked/);assert.ok(!view.html.includes('aria-current="step"'));
 mutateRoom(room,'reset',hashToken(tokens[0]),1,19000);
 view=render(19001);assert.deepEqual(view.state.room.turnOrder,[]);assert.match(view.html,/Joined/);assert.ok(!view.html.includes('turn-banner'));
});

test('non-turn rooms mark every unpicked participant ready',()=>{
 const token=newToken(),room=createRoom('Alice',{turnBased:false},hashToken(token));
 joinRoom(room,'Bob',hashToken(newToken()));mutateRoom(room,'start',hashToken(token),1,200);
 const state=serializeRoom(room,hashToken(token),300);
 const html=renderToStaticMarkup(createElement(Fragment,null,createElement(TurnBanner,{state}),createElement(GuestList,{state,onRefresh(){}})));
 assert.match(html,/Everyone can spin now/);assert.equal((html.match(/status-ready/g)||[]).length,2);
});

function fakeImageEnvironment(t,{decode=true,encodedBytes=100000}={}) {
 const originals={Image:Object.getOwnPropertyDescriptor(globalThis,'Image'),document:Object.getOwnPropertyDescriptor(globalThis,'document')};
 const draws=[],sizes=[],revoked=[];
 class Image {
  naturalWidth=4000;naturalHeight=3000;
  set src(value){queueMicrotask(()=>decode?this.onload?.():this.onerror?.());}
 }
 const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);}}),toDataURL(type,quality){sizes.push([canvas.width,canvas.height,quality]);const bytes=typeof encodedBytes==='function'?encodedBytes(canvas.width,quality):encodedBytes;return `data:${type};base64,${'A'.repeat(Math.ceil(bytes*4/3))}`;}};
 Object.defineProperty(globalThis,'Image',{configurable:true,value:Image});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>canvas}});
 t.mock.method(URL,'createObjectURL',()=> 'blob:test-cover');
 t.mock.method(URL,'revokeObjectURL',value=>revoked.push(value));
 t.after(()=>{for(const [name,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 return {draws,sizes,revoked};
}

test('large photo is resized before encoding and fits the stored room/request limits',async t=>{
 const env=fakeImageEnvironment(t);
 const image=await prepareCoverImage(new File([new Uint8Array(2*1024*1024)],'phone.jpg',{type:'image/jpeg'}));
 assert.deepEqual(env.sizes[0].slice(0,2),[1024,768]);
 assert.equal(env.draws.length,1);assert.deepEqual(env.revoked,['blob:test-cover']);
 assert.equal(cleanSettings({coverImage:image}).coverImage,image);
 assert.ok(Buffer.byteLength(JSON.stringify({action:'create',name:'Alice',settings:{coverImage:image}}))<450000);
});

test('invalid, unsupported and oversized photos fail with usable reasons and release their URLs',async t=>{
 const env=fakeImageEnvironment(t,{decode:false});
 await assert.rejects(prepareCoverImage(new File(['bad'],'broken.png',{type:'image/png'})),{reason:'decode'});
 assert.deepEqual(env.revoked,['blob:test-cover']);
 await assert.rejects(prepareCoverImage(new File(['heic'],'phone.heic',{type:'image/heic'})),{reason:'type'});
 await assert.rejects(prepareCoverImage({name:'huge.jpg',type:'image/jpeg',size:21*1024*1024}),{reason:'size'});
});

test('high-detail photos reduce quality and dimensions until the encoded cover fits',async t=>{
 const env=fakeImageEnvironment(t,{encodedBytes:(width,quality)=>width<=768&&quality<=0.74?200000:350000});
 const image=await prepareCoverImage(new File(['photo'],'photo.png',{type:'image/png'}));
 assert.deepEqual(env.sizes.at(-1),[768,576,0.74]);
 assert.equal(env.draws.length,2);
 assert.ok(image.length<410000);
 assert.deepEqual(env.revoked,['blob:test-cover']);
});

test('saved holiday/light/dark/system appearance is applied before paint',()=>{
 const source=fs.readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');
 for(const [saved,dark,expected] of [[null,false,'holiday'],['holiday',true,'holiday'],['light',true,'light'],['dark',false,'dark'],['system',true,'dark'],['system',false,'light'],['invalid',false,'holiday']]){
  const root={dataset:{}};let color;
  vm.runInNewContext(source,{localStorage:{getItem:()=>saved},matchMedia:()=>({matches:dark}),document:{documentElement:root,querySelector:()=>({setAttribute:(name,value)=>{color=value;}})}});
  assert.equal(root.dataset.theme,expected);assert.match(color,/^#[a-f0-9]{6}$/);
  if(expected==='holiday')assert.equal(color,'#160e19');
 }
});

test('reference homepage includes the three-line heading, real actions, wheel and generated decorations',()=>{
 const html=renderToStaticMarkup(createElement(HomePage,{rooms:[],busy:false,onCreate(){},onJoin(){},onRestore(){}}));
 assert.match(html,/<span>Good people\.<\/span><span>Great surprises\.<\/span><em>Christmas magic\.<\/em>/);
 assert.match(html,/Create a room/);assert.match(html,/Join a room/);
 assert.match(html,/christmas-steps/);assert.match(html,/Make it yours/);
 assert.match(html,/\/assets\/christmas-gifts\.png/);
 assert.equal((html.match(/data-wheel-slice=/g)||[]).length,8);
 assert.equal((html.match(/class="wheel-bulb"/g)||[]).length,28);
 const hebrew=renderToStaticMarkup(createElement(HomePage,{hebrew:true,rooms:[],busy:false,onCreate(){},onJoin(){},onRestore(){}}));
 assert.ok(!hebrew.includes('Great surprises.'));
});

test('Christmas atmosphere uses shaped snowflakes, separate depth layers, lights and ornaments',()=>{
 const html=renderToStaticMarkup(createElement(FestiveAtmosphere));
 assert.equal((html.match(/class="snowflake snowflake-depth-/g)||[]).length,32);
 assert.equal((html.match(/class="fairy-bulb /g)||[]).length,30);
 assert.match(html,/lucide-snowflake/);assert.match(html,/\/assets\/christmas-ornaments\.png/);
 assert.match(html,/aria-hidden="true"/);assert.ok(!html.includes('<i '));
});

test('redesign defaults to dark holiday even if an old automatic theme preference exists',()=>{
 const source=fs.readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');
 const root={dataset:{}};
 vm.runInNewContext(source,{localStorage:{getItem:key=>key==='ww.theme'?'light':null},matchMedia:()=>({matches:false}),document:{documentElement:root,querySelector:()=>({setAttribute(){}})}});
 assert.equal(root.dataset.theme,'holiday');assert.equal(root.dataset.motion,'full');
});

function pointerEnvironment() {
 const target=new EventTarget(),reduced=new EventTarget();
 reduced.matches=false;
 let time=100;
 target.performance={now:()=>time};
 target.matchMedia=query=>query.includes('reduced-motion')?reduced:{matches:true};
 const children=new Set();
 const layer={append:node=>children.add(node),ownerDocument:{createElement:()=>{
  const node={style:{},remove:()=>children.delete(node),animate:(frames,options)=>{
   const animation={cancel(){queueMicrotask(()=>animation.oncancel?.());}};
   node.frames=frames;node.options=options;node.animation=animation;return animation;
  }};
  return node;
 }}};
 function send(type,properties={}){
  time+=100;
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:30,clientY:40,...properties});
  target.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
 }
 return {target,reduced,children,layer,send,advance:milliseconds=>{time+=milliseconds;}};
}

test('mobile taps burst at the contact point while swipes, cancellation and long presses stay quiet',()=>{
 const env=pointerEnvironment(),detach=attachPointerMagic(env.layer,env.target);
 try {
  env.send('pointerdown');env.send('pointerup');
  assert.equal(env.children.size,12);
  const first=[...env.children][0];assert.equal(first.style.left,'30px');assert.equal(first.style.top,'40px');
  for(const node of [...env.children])node.animation.onfinish();
  env.send('pointerdown');env.send('pointermove',{clientX:80});env.send('pointerup',{clientX:80});
  assert.equal(env.children.size,0);
  env.send('pointerdown');env.send('pointercancel');env.send('pointerup');
  assert.equal(env.children.size,0);
  env.send('pointerdown');env.advance(700);env.send('pointerup');
  assert.equal(env.children.size,0);
 }finally{detach();}
});

test('pointer effects cap rapid taps, stop for reduced motion, and detach cleanly',()=>{
 const env=pointerEnvironment(),detach=attachPointerMagic(env.layer,env.target);
 for(let index=0;index<20;index++){env.send('pointerdown');env.send('pointerup');}
 assert.equal(env.children.size,72);
 env.reduced.matches=true;env.reduced.dispatchEvent(new Event('change'));
 assert.equal(env.children.size,0);
 env.send('pointerdown');env.send('pointerup');assert.equal(env.children.size,0);
 env.reduced.matches=false;
 detach();env.send('pointerdown');env.send('pointerup');assert.equal(env.children.size,0);
});

test('desktop cursor trail is tiny and desktop clicks do not trigger mobile bursts',()=>{
 const env=pointerEnvironment(),detach=attachPointerMagic(env.layer,env.target);
 try {
  env.send('pointerdown',{pointerType:'mouse'});env.send('pointerup',{pointerType:'mouse'});
  assert.equal(env.children.size,0);
  env.send('pointermove',{pointerType:'mouse'});
  assert.equal(env.children.size,1);
  const node=[...env.children][0];assert.ok(parseFloat(node.style.fontSize)<8);assert.equal(node.options.duration,380);
 }finally{detach();}
 assert.equal(env.children.size,0);
});

test('joining a names wheel grows a new wedge while preserving a full circle throughout',()=>{
 const old=sliceArcs(['a','b']),next=sliceArcs(['a','b','c']);
 const start=interpolateSlices(old,next,0),middle=interpolateSlices(old,next,.5),end=interpolateSlices(old,next,1);
 assert.equal(start.get('c').end-start.get('c').start,0);
 assert.equal(middle.get('c').end-middle.get('c').start,60);
 assert.equal(end.get('c').end-end.get('c').start,120);
 for(const snapshot of [start,middle,end])assert.equal([...snapshot.values()].reduce((sum,arc)=>sum+arc.end-arc.start,0),360);
 assert.deepEqual(end,next);
});

function memoryStorage(t){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;});
 return values;
}
function savedState(index=0){return {room:{code:`AB${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}2C`,settings:{title:`Room ${index}`},phase:'lobby'},me:{name:'Alice',isOwner:index%2===0}};}

test('remembered rooms retain older entries beyond twenty and recovery files restore owner access metadata',t=>{
 const storage=memoryStorage(t);
 for(let index=0;index<35;index++)assert.equal(roomMemory.saveRoom(savedState(index),'A'.repeat(43)),true);
 assert.equal(roomMemory.savedRooms().length,35);
 const original=roomMemory.savedRooms(),file=roomMemory.recoveryFile(original);
 storage.clear();assert.equal(roomMemory.savedRooms().length,0);
 assert.equal(roomMemory.importRecoveryFile(file),35);
 assert.deepEqual(roomMemory.savedRooms().map(room=>room.code).sort(),original.map(room=>room.code).sort());
 assert.equal(roomMemory.savedRooms().find(room=>room.code===savedState(0).room.code).isOwner,true);
});

test('recovery import preserves existing host access and rejects malformed files without replacing storage',t=>{
 const storage=memoryStorage(t);roomMemory.saveRoom(savedState(),'A'.repeat(43));
 const owner=roomMemory.savedRooms()[0];
 roomMemory.importRecoveryFile(roomMemory.recoveryFile([{...owner,token:'B'.repeat(43),isOwner:false,updated:owner.updated+100}]));
 assert.equal(roomMemory.savedRooms()[0].token,owner.token);
 const before=storage.get('ww.rooms');
 assert.throws(()=>roomMemory.importRecoveryFile('{"rooms":[]}'));
 assert.throws(()=>roomMemory.importRecoveryFile(roomMemory.recoveryFile([{...owner,token:'invalid'}])));
 assert.equal(storage.get('ww.rooms'),before);
 const old={...owner,updated:Date.now()-366*24*60*60*1000};storage.set('ww.rooms',JSON.stringify([old]));
 assert.equal(roomMemory.savedRooms()[0].code,owner.code);
});

test('room library renders all saved rooms, backup controls and role labels',()=>{
 const rooms=Array.from({length:30},(_,index)=>({code:savedState(index).room.code,token:'A'.repeat(43),name:'Alice',title:`Remembered ${index}`,updated:100,isOwner:index%2===0}));
 const html=renderToStaticMarkup(createElement(RoomLibrary,{rooms,busy:false,onRestore(){}}));
 assert.equal((html.match(/<strong>Remembered /g)||[]).length,30);
 assert.match(html,/Back up all rooms/);assert.match(html,/Import recovery file/);assert.match(html,/Created by you/);
 assert.ok(!html.includes('A'.repeat(43)));
});

test('kick controls appear only for the host and roster identities show the correct lock state',()=>{
 const token=newToken(),other=newToken(),room=createRoom('Alice',{participantMode:'roster',roster:['Alice','Bob']},hashToken(token));joinRoom(room,'Bob',hashToken(other),Date.now(),issueInvitationCodes(room,hashToken(token)).find(person=>person.name==='Bob').code);
 const host=serializeRoom(room,hashToken(token)),guest=serializeRoom(room,hashToken(other));
 const hostHTML=renderToStaticMarkup(createElement(GuestList,{state:host,onRefresh(){},onKick:async()=>true}));
 const guestHTML=renderToStaticMarkup(createElement(GuestList,{state:guest,onRefresh(){},onKick:async()=>true}));
 assert.equal((hostHTML.match(/class="kick-button"/g)||[]).length,1);assert.ok(!guestHTML.includes('kick-button'));
 const lobby=renderToStaticMarkup(createElement(RoomIdentity,{state:host,busy:false,onChange(){}}));assert.ok(!lobby.includes('<select'));assert.match(lobby,/private code assigned/);
 mutateRoom(room,'start',hashToken(token),1,200);
 const locked=renderToStaticMarkup(createElement(RoomIdentity,{state:serializeRoom(room,hashToken(token),300),busy:false,onChange(){}}));
 assert.ok(!locked.includes('<select'));assert.match(locked,/private code assigned/);
});
