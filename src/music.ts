import {BEAT_SECONDS,LOOP_BEATS,MUSIC_EVENTS,frequency} from './jingle-bells';

// The app performs its own instrumental arrangement in Web Audio: chiming
// bells, soft chords and synthesized sleigh bells. No samples or vocals.
type Run = {
 context:AudioContext; master:GainNode; compressor:DynamicsCompressorNode;
 reverb:ConvolverNode; wet:GainNode; noise:AudioBuffer;
 voices:Set<AudioScheduledSourceNode>; timer:ReturnType<typeof setInterval>|null;
 cycleStart:number; event:number;
};
let context:AudioContext|null = null, current:Run|null = null, generation = 0;
const level = (volume:number) => (Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0)*.3;

function envelope(run:Run,source:AudioScheduledSourceNode,time:number,duration:number,amplitude:number) {
 const gain=run.context.createGain();
 gain.gain.setValueAtTime(0,time);
 gain.gain.linearRampToValueAtTime(amplitude,time+.005);
 gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
 source.connect(gain);gain.connect(run.master);
 run.voices.add(source);
 source.onended=()=>{source.disconnect();gain.disconnect();run.voices.delete(source);};
 source.start(time);source.stop(time+duration+.02);
}

function bell(run:Run,midi:number,time:number,beats:number) {
 const pitch=frequency(midi);
 const decay=Math.min(2.5,beats*BEAT_SECONDS*.75+.7);
 // Inharmonic upper partials give a struck-bell shimmer rather than a beep.
 for(const [ratio,amplitude] of [[1,.28],[2.756,.065],[5.404,.018],[8.933,.006]]) {
  const oscillator=run.context.createOscillator();oscillator.type='sine';
  oscillator.frequency.setValueAtTime(pitch*ratio,time);
  envelope(run,oscillator,time,Math.max(.16,decay/Math.sqrt(ratio)),amplitude);
 }
}

function chord(run:Run,notes:number[],time:number) {
 for(let index=0;index<notes.length;index++) {
  const oscillator=run.context.createOscillator();oscillator.type='triangle';
  oscillator.frequency.setValueAtTime(frequency(notes[index]),time);
  envelope(run,oscillator,time+index*.035,1.2,.018);
 }
}

function sleigh(run:Run,time:number,accent:boolean) {
 const source=run.context.createBufferSource();source.buffer=run.noise;
 const filter=run.context.createBiquadFilter();filter.type='highpass';filter.frequency.value=6000;
 const gain=run.context.createGain();gain.gain.setValueAtTime(accent ? .034 : .019,time);
 gain.gain.exponentialRampToValueAtTime(.0001,time+.09);
 source.connect(filter);filter.connect(gain);gain.connect(run.master);
 run.voices.add(source);
 source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();run.voices.delete(source);};
 source.start(time);source.stop(time+.12);
 if(accent)for(const [pitch,amplitude] of [[3870,.012],[6210,.007]]) {
  const oscillator=run.context.createOscillator();oscillator.type='sine';oscillator.frequency.value=pitch;
  envelope(run,oscillator,time,.16,amplitude);
 }
}

function schedule(run:Run) {
 if(current!==run||run.context.state!=='running')return;
 const now=run.context.currentTime;
 if(run.cycleStart+MUSIC_EVENTS[run.event].beat*BEAT_SECONDS<now-.25) {
  // Background tabs can throttle timers. Resume gently instead of playing
  // missed notes all at once when the user returns.
  run.cycleStart=now+.04;run.event=0;
 }
 while(run.cycleStart+MUSIC_EVENTS[run.event].beat*BEAT_SECONDS<now+.16) {
  const event=MUSIC_EVENTS[run.event],time=run.cycleStart+event.beat*BEAT_SECONDS;
  if(event.kind==='melody')bell(run,event.midi,time,event.beats);
  else if(event.kind==='chord')chord(run,event.notes,time);
  else sleigh(run,time,event.accent);
  run.event++;
  if(run.event===MUSIC_EVENTS.length){run.event=0;run.cycleStart+=LOOP_BEATS*BEAT_SECONDS;}
 }
}

function createRun(audio:AudioContext,volume:number):Run {
 const master=audio.createGain(),compressor=audio.createDynamicsCompressor();
 master.gain.setValueAtTime(0,audio.currentTime);master.gain.linearRampToValueAtTime(level(volume),audio.currentTime+.2);
 compressor.threshold.value=-18;compressor.knee.value=14;compressor.ratio.value=3;
 compressor.attack.value=.003;compressor.release.value=.25;
 master.connect(compressor);compressor.connect(audio.destination);
 const reverb=audio.createConvolver(),wet=audio.createGain();wet.gain.value=.16;
 const impulse=audio.createBuffer(2,Math.floor(audio.sampleRate*1.25),audio.sampleRate);
 for(let channel=0;channel<2;channel++) {
  const samples=impulse.getChannelData(channel);
  for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3)*.35;
 }
 reverb.buffer=impulse;master.connect(reverb);reverb.connect(wet);wet.connect(compressor);
 const noise=audio.createBuffer(1,Math.floor(audio.sampleRate*.12),audio.sampleRate);
 const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 return {context:audio,master,compressor,reverb,wet,noise,voices:new Set(),timer:null,cycleStart:audio.currentTime+.04,event:0};
}

export async function playMusic(volume=.35) {
 const request=++generation;
 if(!context||context.state==='closed')context=new AudioContext();
 const audio=context;
 await audio.resume();
 if(request!==generation)return;
 if(current){setVolume(volume);return;}
 const run=createRun(audio,volume);current=run;schedule(run);
 run.timer=setInterval(()=>schedule(run),25);
}

export function stopMusic() {
 generation++;
 const run=current;if(!run)return;current=null;
 if(run.timer!==null)clearInterval(run.timer);
 const now=run.context.currentTime;
 run.master.gain.cancelScheduledValues(now);run.master.gain.setTargetAtTime(0,now,.03);
 for(const voice of run.voices){try{voice.stop(now+.18);}catch{/* Already ended. */}}
 setTimeout(()=>{run.master.disconnect();run.reverb.disconnect();run.wet.disconnect();run.compressor.disconnect();run.voices.clear();},250);
}

export function setVolume(volume:number) {
 if(current)current.master.gain.setTargetAtTime(level(volume),current.context.currentTime,.1);
}
