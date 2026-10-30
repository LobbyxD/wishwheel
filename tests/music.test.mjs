import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {fileURLToPath} from 'node:url';

let moduleId=0;
async function load(path){
 const result=buildSync({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${moduleId++}`);
}
const score=await load('../src/jingle-bells.ts');

function audioEnvironment(t,{deferred=false}={}){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
 const instances=[];
 function param(){return {value:0,events:[],setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);},linearRampToValueAtTime(value,time){this.value=value;this.events.push(['linear',value,time]);},exponentialRampToValueAtTime(value,time){this.value=value;this.events.push(['exponential',value,time]);},setTargetAtTime(value,time){this.value=value;this.events.push(['target',value,time]);},cancelScheduledValues(){}};}
 function node(){return {connections:[],disconnected:false,connect(target){this.connections.push(target);return target;},disconnect(){this.disconnected=true;}};}
 class AudioContext{
  currentTime=0;state='running';sampleRate=48000;destination=node();gains=[];sources=[];compressors=[];
  constructor(){instances.push(this);}
  resume(){return deferred?new Promise(resolve=>{this.finishResume=resolve;}):Promise.resolve();}
  createGain(){const gain={...node(),gain:param()};this.gains.push(gain);return gain;}
  createDynamicsCompressor(){const compressor={...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};this.compressors.push(compressor);return compressor;}
  createConvolver(){return node();}
  createBuffer(channels,length){const arrays=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:index=>arrays[index]};}
  createBiquadFilter(){return {...node(),frequency:param()};}
  source(){const source={...node(),frequency:param(),starts:[],stops:[],start(time){this.starts.push(time);},stop(time){this.stops.push(time);}};this.sources.push(source);return source;}
  createOscillator(){return this.source();}
  createBufferSource(){return this.source();}
 }
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:AudioContext});
 t.mock.timers.enable({apis:['setInterval','setTimeout']});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'AudioContext',descriptor);else delete globalThis.AudioContext;});
 return instances;
}

test('instrumental chorus has recognizable opening, complete bars, chords and sleigh-bell rhythm',()=>{
 assert.equal(score.CHORUS.length,16);
 for(const bar of score.CHORUS)assert.equal(bar.reduce((sum,note)=>sum+note[1],0),4);
 assert.deepEqual(score.CHORUS[0],[[76,1],[76,1],[76,2]]);
 assert.deepEqual(score.CHORUS[2],[[76,1],[79,1],[72,1],[74,1]]);
 assert.equal(score.LOOP_BEATS,64);
 assert.equal(score.MUSIC_EVENTS.filter(event=>event.kind==='chord').length,16);
 assert.equal(score.MUSIC_EVENTS.filter(event=>event.kind==='sleigh').length,128);
 assert.ok(Math.abs(score.frequency(76)-659.255)<.01);
});

test('play schedules synthesized bells and accompaniment once; mute stops future notes and disconnects output',async t=>{
 const instances=audioEnvironment(t),music=await load('../src/music.ts');
 await music.playMusic(.35);const audio=instances[0];
 assert.ok(audio.sources.some(source=>Math.abs(source.frequency.value-659.255)<.01));
 assert.ok(audio.sources.some(source=>source.buffer));
 const initial=audio.sources.length;
 await music.playMusic(.5);assert.equal(audio.sources.length,initial);assert.equal(audio.compressors.length,1);
 music.setVolume(10);assert.equal(audio.gains[0].gain.value,.3);
 music.setVolume(-1);assert.equal(audio.gains[0].gain.value,0);
 music.stopMusic();
 assert.ok(audio.sources.every(source=>source.stops.at(-1)<=.18));
 audio.currentTime=10;t.mock.timers.tick(1000);
 assert.equal(audio.sources.length,initial);assert.equal(audio.gains[0].disconnected,true);assert.equal(audio.compressors[0].disconnected,true);
 for(const source of audio.sources)source.onended?.();
 assert.ok(audio.sources.every(source=>source.disconnected));
});

test('returning after timer throttling does not play a backlog of missed notes',async t=>{
 const instances=audioEnvironment(t),music=await load('../src/music.ts');
 await music.playMusic();const audio=instances[0],before=audio.sources.length;
 audio.currentTime=20;t.mock.timers.tick(25);
 const newSources=audio.sources.slice(before);
 assert.ok(newSources.length>0&&newSources.length<20);
 assert.ok(newSources.every(source=>source.starts[0]>=20));
 music.stopMusic();t.mock.timers.tick(300);
});

test('muting while the audio context resumes cancels the pending start',async t=>{
 const instances=audioEnvironment(t,{deferred:true}),music=await load('../src/music.ts');
 const pending=music.playMusic();music.stopMusic();instances[0].finishResume();await pending;
 assert.equal(instances[0].sources.length,0);assert.equal(instances[0].gains.length,0);
});
