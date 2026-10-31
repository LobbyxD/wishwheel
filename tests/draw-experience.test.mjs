import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {Window} from 'happy-dom';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createRoom,joinRoom,mutateRoom,serializeRoom,hashToken,newToken} from '../server/engine.mjs';

async function loadSource(path){
 const built=buildSync({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
 const source=built.outputFiles[0].text.replace(/from "(react(?:\/[^" ]+)?|react-dom(?:\/[^" ]+)?|lucide-react)"/g,(_,name)=>`from ${JSON.stringify(import.meta.resolve(name))}`);
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {naturalFontSize,wheelSlicePath,landedSlice,sliceSource,sliceRevealSize,rectTransform}=await loadSource('../src/draw-motion.ts');
const {nextActivity,publicPlayers}=await loadSource('../src/room-activity.ts');
const {default:DrawReveal}=await loadSource('../src/DrawReveal.tsx');
const {RosterFields}=await loadSource('../src/RosterFields.tsx');
const {applyRoomEvent,reconcileState,settleRoomSpins}=await loadSource('../src/room-state.ts');
const {useAccount,signInWithGoogle}=await loadSource('../src/auth.ts');

test('landed slice geometry and fly-to-card transforms stay finite for every supported wheel size',()=>{
 for(let count=1;count<=100;count++){
  const shape=landedSlice(count),source=sliceSource({left:20,top:50,width:400,height:400},count);
  assert.ok(shape.width>0&&shape.height>0);assert.ok(!/NaN|Infinity/.test(shape.polygon));
  assert.equal(shape.polygon.split(',').length,shape.rectangle.split(',').length);
  assert.ok(source.top>=50&&source.top+source.height<=450);
  assert.ok(!/NaN|Infinity/.test(rectTransform(source,{left:0,top:0,width:290,height:290})));
 }
 assert.equal(rectTransform({left:10,top:20,width:100,height:100},{left:0,top:0,width:0,height:0}),'none');
});

test('popped slices preserve the wheel sector proportions on desktop, mobile and landscape',()=>{
 for(const count of [1,2,3,4,6,8,12,50,100])for(const viewport of [{width:1920,height:1080},{width:390,height:844},{width:844,height:390}]){
  const shape=landedSlice(count),size=sliceRevealSize(count,viewport),source=sliceSource({left:20,top:40,width:400,height:400},count);
  assert.ok(Math.abs(size.width/size.height-shape.width/shape.height)<1e-10);
  assert.ok(size.width<=viewport.width-64);assert.ok(size.height<=viewport.height-170);
  const transform=rectTransform(source,{left:0,top:0,...size},true),scales=transform.match(/scale\(([^)]+)\)/)[1].split(',');
  assert.equal(scales.length,1,'Opening must use one uniform scale; two axes stretch the circular sector');
 }
 const three=sliceRevealSize(3,{width:1920,height:1080});assert.ok(Math.abs(three.width/three.height-Math.sqrt(3))<1e-10);
 const squareSource=sliceSource({left:20,top:40,width:400,height:400},3),letterboxed=sliceSource({left:20,top:40,width:600,height:400},3);
 assert.equal(letterboxed.left,squareSource.left+100);assert.equal(letterboxed.width/squareSource.width,1);assert.equal(letterboxed.height/squareSource.height,1);
});

function dom(t){
 const window=new Window({url:'http://localhost:5173'}),document=window.document;
 const saved=new Map();
 for(const [key,value] of Object.entries({window,document,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,getComputedStyle:window.getComputedStyle.bind(window),matchMedia:()=>({matches:false}),requestAnimationFrame:callback=>{queueMicrotask(()=>callback(0));return 1;},IS_REACT_ACT_ENVIRONMENT:true})){
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const animations=[];
 window.Element.prototype.animate=function(frames,options){
  let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const animation={element:this,frames,options,finished,pending:true,cancelled:false,finish(){if(this.pending){this.pending=false;resolve();}},cancel(){this.cancelled=true;if(this.pending){this.pending=false;reject(new Error('Animation cancelled'));}}};
  animations.push(animation);if(options.duration===0)queueMicrotask(()=>animation.finish());return animation;
 };
 window.Element.prototype.getAnimations=function(){return animations.filter(animation=>animation.element===this&&!animation.cancelled);};
 window.Element.prototype.scrollIntoView=function(){this.dataset.scrolled='true';};
 window.Element.prototype.getBoundingClientRect=function(){return this.matches('.draw-ticket')?{left:350,top:200,width:parseFloat(this.style.width)||290,height:parseFloat(this.style.height)||290}:this.matches('svg')?{left:40,top:120,width:400,height:400}:{left:50,top:650,width:350,height:190};};
 document.body.innerHTML='<div id="root"></div>';
 const root=createRoot(document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());await window.happyDOM.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 return {document,root,animations};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function finish(animations,predicate=()=>true){await act(async()=>{for(const animation of animations)if(animation.pending&&predicate(animation))animation.finish();await tick();});}
const secret='A wonderfully private surprise';
function fixture(onDock,reduced=false,label=secret){
 function Host(){
  const [show,setShow]=useState(true);
  const wheel=React.useRef(null),destination=React.useRef(null);
  return React.createElement(React.Fragment,null,
   React.createElement('div',{ref:wheel},React.createElement('svg')),
   React.createElement('section',{ref:destination,'data-destination':true,className:show?'is-awaiting-slice':''},React.createElement('button',{'aria-label':'Tap to reveal'},React.createElement('span',{'aria-hidden':true},label))),
   show&&React.createElement(DrawReveal,{result:{id:'item-4',label},count:8,index:4,settings:{wheelHidden:true,coverType:'image',coverImage:'/test-cover.webp'},wheel,destination,reduced,onDock(){onDock();setShow(false);}}));
 }
 return React.createElement(Host);
}

test('first-result popup twirls to its back, vanishes the text, morphs and docks into a hidden card',async t=>{
 const {document,root,animations}=dom(t);let docked=0;
 await act(async()=>{root.render(fixture(()=>docked++));await tick();});
 assert.equal(document.getElementById('root').inert,true);
 assert.equal(document.activeElement.getAttribute('aria-label'),'Close');
 assert.ok(!document.querySelector('.draw-reveal').textContent.includes(secret));
 const piece=document.querySelector('.draw-ticket'),shape=landedSlice(8);
 assert.ok(Math.abs(parseFloat(piece.style.width)/parseFloat(piece.style.height)-shape.width/shape.height)<1e-6);
 assert.equal(document.querySelector('.slice-front>svg').getAttribute('preserveAspectRatio'),'xMidYMid meet');
 assert.equal(document.querySelector('.slice-back .slice-surface path').getAttribute('d'),wheelSlicePath(-22.5,22.5));
 assert.equal(document.querySelector('.slice-back .slice-surface').getAttribute('preserveAspectRatio'),'xMidYMid meet');
 const turn=animations.find(animation=>animation.element.matches('.draw-flipper'));
 const finalAngle=Number(turn.frames.at(-1).transform.match(/rotateY\((\d+)deg/)[1]);
 assert.ok(finalAngle>1080);assert.equal(finalAngle%360,180);
 await finish(animations);
 assert.equal(document.querySelector('.result-ink').getAttribute('aria-label'),secret);
 await act(async()=>{document.querySelector('.draw-controls button').click();await tick();});
 assert.ok(animations.some(animation=>animation.element.matches('.result-ink [data-ink]')&&animation.frames.at(-1).opacity===0));
 await finish(animations,animation=>animation.element.matches('.result-ink [data-ink]'));
 assert.ok(document.querySelector('.draw-reveal').classList.contains('phase-docking'));
 assert.ok(!document.querySelector('.draw-reveal').textContent.includes(secret));
 assert.equal(document.querySelector('[data-destination]').dataset.scrolled,'true');
 assert.ok(animations.some(animation=>animation.element.matches('.slice-back')&&animation.frames[0].clipPath!==animation.frames[1].clipPath));
 await finish(animations);
 const returning=animations.filter(animation=>animation.element.matches('.draw-flipper'));assert.equal(returning.length,2);assert.notEqual(returning[1].frames[0].transform,returning[1].frames[1].transform);
 assert.equal(docked,1);assert.equal(document.querySelector('.draw-reveal'),null);
 assert.equal(document.getElementById('root').inert,false);
 assert.equal(document.querySelector('[data-destination] span').getAttribute('aria-hidden'),'true');
});

test('Escape can skip the twirl and reduced motion completes without animated travel',async t=>{
 const {document,root,animations}=dom(t);let docked=0;
 await act(async()=>{root.render(fixture(()=>docked++));await tick();});
 await act(async()=>{document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();});
 assert.ok(!document.querySelector('.draw-reveal').textContent.includes(secret));
 await finish(animations);assert.equal(docked,1);
 await act(async()=>{root.render(null);await tick();root.render(fixture(()=>docked++,true));await tick();});
 assert.equal(document.querySelector('.result-ink').getAttribute('aria-label'),secret);
 const start=animations.length;
 await act(async()=>{document.querySelector('.draw-controls button').click();await tick();await tick();});
 assert.equal(docked,2);assert.ok(animations.slice(start).every(animation=>animation.options.duration===0));
});

test('reset or navigation during a reveal cancels animations and restores focus/scroll access',async t=>{
 const {document,root,animations}=dom(t);let docked=0;
 document.body.style.overflow='auto';
 await act(async()=>{root.render(fixture(()=>docked++));await tick();});
 await act(async()=>{root.render(null);await tick();});
 assert.ok(animations.every(animation=>animation.cancelled));assert.equal(document.querySelector('.draw-reveal'),null);
 assert.equal(document.getElementById('root').inert,false);assert.equal(document.body.style.overflow,'auto');assert.equal(docked,0);
});

test('spectators observe public progress, catch missed spins and never replay old completed draws',()=>{
 const waiting=[{id:'me',name:'Alice',status:'waiting'},{id:'bob',name:'Bob',status:'waiting'}];
 const picking=[waiting[0],{id:'bob',name:'Bob',status:'picking',spinStartedAt:1000,spinEndsAt:7000}];
 const picked=[waiting[0],{...picking[1],status:'picked'}];
 assert.equal(nextActivity(null,picked,'me',8000),null);
 const activity=nextActivity(waiting,picking,'me',3000);assert.equal(activity.phase,'picking');assert.equal(activity.remaining,4000);
 assert.deepEqual(activity.people,['Bob']);assert.equal(nextActivity(picking,picking,'me',4000),null);
 assert.equal(nextActivity(waiting,picked,'me',8000).phase,'celebrating');
 assert.equal(nextActivity(waiting,picked,'me',30000),null);
 assert.equal(nextActivity(waiting,picking,'bob',3000),null);
 assert.deepEqual(Object.keys(publicPlayers([{...picking[1],result:{label:'NEVER DISPLAY'}}])[0]).sort(),['id','name','spinEndsAt','spinStartedAt','status']);
});

test('server exposes spin timing to spectators without the chosen item or landing angle',()=>{
 const owner=hashToken(newToken()),guest=hashToken(newToken());
 const room=createRoom('Alice',{poolMode:'custom',items:['Private A','Private B'],wheelHidden:true,turnBased:false},owner);
 joinRoom(room,'Bob',guest);mutateRoom(room,'start',owner,1,100);mutateRoom(room,'spin',guest,1,1000);
 const state=serializeRoom(room,owner,2000),bob=state.room.members.find(person=>person.name==='Bob');
 assert.equal(bob.status,'picking');assert.equal(bob.spinStartedAt,1000);assert.equal(bob.spinEndsAt,7000);
 assert.equal(state.room.serverNow,2000);assert.equal(state.me.result,null);
 assert.ok(!JSON.stringify(bob).match(/result|itemId|angle|label|Private/));
});

test('guest fields grow beyond fifty, add focuses the new field, and removing keeps the remaining people',async t=>{
 const {document,root}=dom(t);
 function Form(){const [names,setNames]=useState(Array.from({length:55},(_,index)=>`Person ${index+1}`));return React.createElement(RosterFields,{settings:{participantMode:'roster'},names,onNames:setNames,onMode(){}});}
 await act(async()=>{root.render(React.createElement(Form));await tick();});
 assert.equal(document.querySelectorAll('.roster-inputs input').length,55);assert.equal(document.querySelector('textarea'),null);
 await act(async()=>{document.querySelector('.add-person').click();await tick();});
 assert.equal(document.querySelectorAll('.roster-inputs input').length,56);assert.equal(document.activeElement,document.querySelectorAll('.roster-inputs input')[55]);
 await act(async()=>{document.querySelector('.roster-input-row button').click();await tick();});
 assert.equal(document.querySelectorAll('.roster-inputs input').length,55);assert.equal(document.querySelector('.roster-inputs input').value,'Person 2');
});

test('live public updates paint membership and spins immediately without overwriting private results or newer rounds',()=>{
 const state={room:{code:'AB23CD',version:1,generation:1,phase:'active',members:[{id:'me',name:'Alice',status:'waiting'}]},me:{id:'me',name:'Alice',status:'waiting',result:null}};
 const joined=applyRoomEvent(state,{type:'room-changed',code:'AB23CD',version:2,generation:1,phase:'active',kind:'join',serverNow:100,member:{id:'bob',name:'Bob',status:'waiting',result:{label:'DO NOT COPY'}}});
 assert.equal(joined.room.members.length,2);assert.equal(joined.room.members[1].result,undefined);
 const spinning=applyRoomEvent(joined,{type:'room-changed',code:'AB23CD',version:3,generation:1,phase:'active',kind:'spin',serverNow:200,member:{id:'bob',name:'Bob',status:'picking',spinStartedAt:200,spinEndsAt:6200}});
 assert.equal(spinning.room.members[1].status,'picking');assert.equal(spinning.me.result,null);
 const latePrivate={...state,room:{...state.room,version:2},me:{...state.me,result:{id:'gift',label:'My own secret'}}};
 const reconciled=reconcileState(spinning,latePrivate);assert.equal(reconciled.room.version,3);assert.equal(reconciled.room.members.length,2);assert.equal(reconciled.me.result.label,'My own secret');
 const reset=applyRoomEvent(reconciled,{type:'room-changed',code:'AB23CD',version:4,generation:2,phase:'lobby',kind:'reset',serverNow:300});
 assert.equal(reset.me.result,null);assert.equal(reconcileState(reset,latePrivate),null);
});

test('simultaneous live spins remain visible when messages arrive out of order, and turns settle without another API request',()=>{
 const state={room:{code:'AB23CD',version:3,generation:1,phase:'active',serverNow:100,settings:{turnBased:true},turnOrder:['bob','carol','me'],turnMemberId:'bob',members:[{id:'me',name:'Alice',status:'waiting'},{id:'bob',name:'Bob',status:'waiting'},{id:'carol',name:'Carol',status:'waiting'}]},me:{id:'me',status:'waiting',result:null}};
 const bob={type:'room-changed',code:'AB23CD',version:4,generation:1,phase:'active',serverNow:200,kind:'spin',member:{id:'bob',name:'Bob',status:'picking',spinStartedAt:200,spinEndsAt:6200}};
 const carol={...bob,version:5,serverNow:300,member:{id:'carol',name:'Carol',status:'picking',spinStartedAt:300,spinEndsAt:6300}};
 const both=applyRoomEvent(applyRoomEvent(state,carol),bob);assert.equal(both.room.version,5);assert.equal(both.room.members.filter(member=>member.status==='picking').length,2);
 assert.equal(applyRoomEvent(both,bob),null);
 const next=settleRoomSpins(both,6400);assert.equal(next.room.turnMemberId,'me');assert.equal(next.room.members.filter(member=>member.status==='picked').length,2);assert.equal(next.me.result,null);
});

test('Google sign-in publishes the verified account immediately without an extra profile request',async t=>{
 const {document,root}=dom(t),previousFetch=globalThis.fetch,calls=[];
 t.after(()=>{globalThis.fetch=previousFetch;});
 globalThis.fetch=async(url,options={})=>{calls.push({url,method:options.method||'GET'});return Response.json(options.method==='POST'?{user:{id:'google:fast',provider:'google',name:'Alice',email:''}}:{user:null,clientId:'public-client',nonce:'A'.repeat(43)});};
 function Account(){const account=useAccount();return React.createElement('p',{id:'account-name'},account.user?.name||'Guest');}
 await act(async()=>{root.render(React.createElement(Account));await tick();});calls.length=0;
 await act(async()=>{await signInWithGoogle('signed-test-credential');await tick();});
 assert.equal(document.getElementById('account-name').textContent,'Alice');assert.equal(calls.length,1);assert.equal(calls[0].method,'POST');
});

test('result labels use natural HTML glyphs with no SVG stretching, including long and Hebrew names',async t=>{
 const {document,root,animations}=dom(t);
 for(const label of ['Daniel','A'.repeat(80),'A long surprise that should wrap rather than widen its letters','דניאל וההפתעה הסודית שלו']){
  await act(async()=>{root.render(fixture(()=>{},true,label));await tick();});
  const text=document.querySelector('.result-ink [data-ink]');
  assert.equal(text.tagName,'STRONG');assert.equal(text.textContent,label);
  assert.equal(document.querySelector('[textLength],[lengthAdjust]'),null);
  assert.equal(text.style.transform,'');
  assert.equal(document.querySelector('.result-ink').tagName,'DIV');
 }
 assert.ok(animations.filter(animation=>animation.element.matches('.draw-flipper')).every(animation=>animation.options.duration===0));
});

test('natural text fitting chooses only font size and never exceeds its measured space',()=>{
 assert.equal(naturalFontSize(size=>size<=23),23);
 assert.equal(naturalFontSize(()=>true),36);
 assert.equal(naturalFontSize(()=>false),8);
});
