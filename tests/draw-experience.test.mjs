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
const {landedSlice,sliceSource,rectTransform}=await loadSource('../src/draw-motion.ts');
const {nextActivity,publicPlayers}=await loadSource('../src/room-activity.ts');
const {default:DrawReveal}=await loadSource('../src/DrawReveal.tsx');

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
 window.Element.prototype.getBoundingClientRect=function(){return this.matches('.draw-ticket')?{left:350,top:200,width:290,height:290}:this.matches('svg')?{left:40,top:120,width:400,height:400}:{left:50,top:650,width:350,height:190};};
 document.body.innerHTML='<div id="root"></div>';
 const root=createRoot(document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());await window.happyDOM.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 return {document,root,animations};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function finish(animations,predicate=()=>true){await act(async()=>{for(const animation of animations)if(animation.pending&&predicate(animation))animation.finish();await tick();});}
const secret='A wonderfully private surprise';
function fixture(onDock,reduced=false){
 function Host(){
  const [show,setShow]=useState(true);
  const wheel=React.useRef(null),destination=React.useRef(null);
  return React.createElement(React.Fragment,null,
   React.createElement('div',{ref:wheel},React.createElement('svg')),
   React.createElement('section',{ref:destination,'data-destination':true,className:show?'is-awaiting-slice':''},React.createElement('button',{'aria-label':'Tap to reveal'},React.createElement('span',{'aria-hidden':true},secret))),
   show&&React.createElement(DrawReveal,{result:{id:'item-4',label:secret},count:8,index:4,settings:{wheelHidden:true,coverType:'image',coverImage:'/test-cover.webp'},wheel,destination,reduced,onDock(){onDock();setShow(false);}}));
 }
 return React.createElement(Host);
}

test('first-result popup twirls to its back, vanishes the text, morphs and docks into a hidden card',async t=>{
 const {document,root,animations}=dom(t);let docked=0;
 await act(async()=>{root.render(fixture(()=>docked++));await tick();});
 assert.equal(document.getElementById('root').inert,true);
 assert.equal(document.activeElement.getAttribute('aria-label'),'Close');
 assert.ok(!document.querySelector('.draw-reveal').textContent.includes(secret));
 const turn=animations.find(animation=>animation.element.matches('.draw-flipper'));
 const finalAngle=Number(turn.frames.at(-1).transform.match(/rotateY\((\d+)deg/)[1]);
 assert.ok(finalAngle>1080);assert.equal(finalAngle%360,180);
 await finish(animations);
 assert.ok(document.querySelector('.draw-reveal').textContent.includes(secret));
 await act(async()=>{document.querySelector('.draw-controls button').click();await tick();});
 assert.ok(animations.some(animation=>animation.element.matches('.result-ink span')&&animation.frames.at(-1).opacity===0));
 await finish(animations,animation=>animation.element.matches('.result-ink span'));
 assert.ok(document.querySelector('.draw-reveal').classList.contains('phase-docking'));
 assert.ok(!document.querySelector('.draw-reveal').textContent.includes(secret));
 assert.equal(document.querySelector('[data-destination]').dataset.scrolled,'true');
 assert.ok(animations.some(animation=>animation.element.matches('.slice-back')&&animation.frames[0].clipPath!==animation.frames[1].clipPath));
 await finish(animations);
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
 assert.ok(document.querySelector('.draw-reveal').textContent.includes(secret));
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
