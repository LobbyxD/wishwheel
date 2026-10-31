import {useId,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,RefObject} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,Gift,LockKeyhole,Sparkles,X} from 'lucide-react';
import {animateElement,landedSlice,naturalFontSize,rectTransform,sliceRevealSize,sliceSource} from './draw-motion';
import type {Item,Settings} from './types';
import {en,he} from './i18n';

export default function DrawReveal({result,count,index,settings,wheel,destination,onDock,hebrew=false,reduced=false}:{
 result:Item;count:number;index:number;settings:Settings;wheel:RefObject<HTMLDivElement|null>;destination:RefObject<HTMLElement|null>;onDock:()=>void;hebrew?:boolean;reduced?:boolean;
}){
 const t=hebrew?he:en,shape=landedSlice(count),id=useId().replace(/:/g,'');
 const [viewport,setViewport]=useState(()=>({width:window.visualViewport?.width||window.innerWidth,height:window.visualViewport?.height||window.innerHeight}));
 const size=sliceRevealSize(count,viewport);
 const [phase,setPhase]=useState<'arriving'|'revealed'|'vanishing'|'docking'>('arriving');
 const ticket=useRef<HTMLDivElement>(null),flipper=useRef<HTMLDivElement>(null),ink=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const lifetime=useRef(new AbortController()),intro=useRef(new AbortController()),closing=useRef(false),closeAction=useRef(()=>{});
 const onDockRef=useRef(onDock);onDockRef.current=onDock;
 const image= settings.wheelHidden&&settings.coverType==='image';
 const color=settings.wheelHidden?settings.coverColor:['#f3dfbb','#e0b66b','#214e47','#f5e2bf','#ac2243','#dfb269','#214e47','#ad2042'][Math.max(index,0)%8];
 useLayoutEffect(()=>{
  const resize=()=>setViewport({width:window.visualViewport?.width||window.innerWidth,height:window.visualViewport?.height||window.innerHeight});
  window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
  return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
 },[]);
 useLayoutEffect(()=>{
  if(phase!=='revealed')return;
  const box=ink.current,text=box?.querySelector<HTMLElement>('[data-ink]');if(!box||!text)return;
  let active=true;
  const fit=()=>{
   if(!active||!box.clientWidth||!box.clientHeight)return;
   const fontSize=naturalFontSize(value=>{text.style.fontSize=`${value}px`;return text.scrollWidth<=box.clientWidth+.5&&text.scrollHeight<=box.clientHeight+.5;});
   text.style.fontSize=`${fontSize}px`;
  };
  fit();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(fit);observer?.observe(box);
  void document.fonts?.ready.then(fit);
  return()=>{active=false;observer?.disconnect();};
 },[phase,result.label,size.width,size.height]);
 useLayoutEffect(()=>{
  lifetime.current=new AbortController();intro.current=new AbortController();
  const signal=intro.current.signal,previous=document.activeElement as HTMLElement|null;
  const app=document.getElementById('root'),wasInert=app?.inert,overflow=document.body.style.overflow;
  if(app)app.inert=true;document.body.style.overflow='hidden';closeButton.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closeAction.current();}
   if(event.key==='Tab'){
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.draw-reveal button:not(:disabled)')];
    const next=buttons.indexOf(document.activeElement as HTMLButtonElement)+(event.shiftKey?-1:1);
    event.preventDefault();buttons[(next+buttons.length)%buttons.length]?.focus();
   }
  };
  document.addEventListener('keydown',key);
  const reducedMotion=reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const piece=ticket.current!,flip=flipper.current!;
  const source=wheel.current?.querySelector('svg')?.getBoundingClientRect();
  const start=source?sliceSource(source,count):piece.getBoundingClientRect();
  void Promise.all([
   animateElement(piece,[{transform:rectTransform(start,piece.getBoundingClientRect(),true),opacity:.3},{transform:'translate(0,-18px) scale(1.12)',opacity:1,offset:.75},{transform:'none',opacity:1}],{duration:reducedMotion?0:1600,easing:'cubic-bezier(.16,.8,.24,1)',fill:'both'},signal),
   animateElement(flip,[{transform:'rotateY(0deg) rotateZ(-8deg)'},{transform:'rotateY(1980deg) rotateZ(0deg)'}],{duration:reducedMotion?0:2050,easing:'cubic-bezier(.12,.68,.12,1)',fill:'forwards'},signal),
  ]).then(()=>{if(!signal.aborted){flip.style.transform='rotateY(1980deg)';setPhase('revealed');}});
  return()=>{
   intro.current.abort();lifetime.current.abort();
   piece.getAnimations().forEach(animation=>animation.cancel());flip.getAnimations().forEach(animation=>animation.cancel());
   document.removeEventListener('keydown',key);document.body.style.overflow=overflow;if(app)app.inert=wasInert||false;
   if(previous?.isConnected)previous.focus({preventScroll:true});
  };
 },[]);

 async function close(){
  if(closing.current)return;closing.current=true;intro.current.abort();
  const signal=lifetime.current.signal,piece=ticket.current!,flip=flipper.current!;
  // Normalize even when Escape skips the initial twirl.
  flip.getAnimations().forEach(animation=>animation.cancel());flip.style.transform='rotateY(1980deg)';
  piece.getAnimations().forEach(animation=>animation.cancel());
  const reduce=reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
  setPhase('vanishing');
  const words=ink.current?.querySelectorAll('[data-ink]')||[];
  await Promise.all([...words].map((word,index)=>animateElement(word,[{opacity:1,filter:'blur(0)',transform:'translateY(0)'},{opacity:0,filter:'blur(12px)',transform:`translate(${index%2?14:-14}px,-70px) scale(.65)`}],{duration:reduce?0:600,delay:reduce?0:Math.min(index*45,150),easing:'ease-in',fill:'forwards'},signal)));
  if(signal.aborted)return;
  setPhase('docking');
  // Scroll behind the fixed dialog first so the destination is visible on phones.
  document.body.style.overflow='';destination.current?.scrollIntoView({behavior:'instant',block:'center'});
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  if(signal.aborted)return;
  const target=destination.current?.getBoundingClientRect(),origin=piece.getBoundingClientRect();
  await Promise.all([
   ...[...flip.querySelectorAll('.slice-face')].map(face=>animateElement(face,[{clipPath:shape.polygon,borderRadius:'0'},{clipPath:shape.rectangle,borderRadius:'18px'}],{duration:reduce?0:850,delay:reduce?0:150,easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'},signal)),
   animateElement(flip,[{transform:'rotateY(1980deg) rotateZ(0deg)'},{transform:'rotateY(3420deg) rotateZ(0deg)'}],{duration:reduce?0:1100,easing:'cubic-bezier(.12,.66,.16,1)',fill:'forwards'},signal),
   animateElement(piece,[{transform:'none',opacity:1},{transform:'translateY(-12px) scale(1.04)',opacity:1,offset:.15},{transform:target?rectTransform(target,origin):'translateY(100px) scale(.7)',opacity:1,offset:.94},{transform:target?rectTransform(target,origin):'translateY(100px) scale(.7)',opacity:0}],{duration:reduce?0:1200,easing:'cubic-bezier(.32,.04,.16,1)',fill:'forwards'},signal),
  ]);
  if(!signal.aborted)onDockRef.current();
 }
 closeAction.current=()=>void close();
 return createPortal(<div className={`draw-reveal phase-${phase}`} dir={hebrew?'rtl':'ltr'} onClick={event=>{if(event.target===event.currentTarget)void close();}}>
  <section className="draw-dialog" role="dialog" aria-modal="true" aria-labelledby="draw-title" aria-describedby="draw-description">
   <button className="icon-button draw-close" ref={closeButton} onClick={()=>void close()} disabled={closing.current} aria-label={t.close}><X size={21}/></button>
   <p className="eyebrow draw-kicker"><Sparkles size={14}/>{t.onlyYourEyes}</p>
   <h2 id="draw-title">{phase==='arriving'?t.unwrappingSlice:phase==='revealed'?t.resultTitle:t.tuckingAway}</h2>
   <p id="draw-description" className="draw-description">{t.slicePrivacy}</p>
   <div className="draw-ticket-space"><div ref={ticket} className="draw-ticket" style={{width:size.width,height:size.height}}><div ref={flipper} className="draw-flipper">
    <div className="slice-face slice-front" style={{clipPath:shape.polygon}} aria-hidden="true">
     <svg className="slice-surface" viewBox={`${shape.left} ${shape.top} ${shape.width} ${shape.height}`} preserveAspectRatio="xMidYMid meet"><path d={shape.path} fill={color}/></svg>
     {image&&<svg viewBox={`${shape.left} ${shape.top} ${shape.width} ${shape.height}`} preserveAspectRatio="xMidYMid meet"><g transform={`rotate(${-((Math.max(index,0)+.5)*360/Math.max(count,1))} 200 200)`}><image href={settings.coverImage||'/assets/holiday-scene.webp'} x="27" y="27" width="346" height="346" preserveAspectRatio="xMidYMid slice"/></g></svg>}
     <div className="slice-front-magic"><Gift size={46} strokeWidth={1}/><span>✦</span></div>
    </div>
    <div className="slice-face slice-back" style={{clipPath:shape.polygon}}>
     <svg className="slice-surface" viewBox={`${shape.left} ${shape.top} ${shape.width} ${shape.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><radialGradient id={`${id}-paper`} cx="50%" cy="0%" r="110%"><stop stopColor="#fff9e4"/><stop offset=".65" stopColor="#f0d8a5"/><stop offset="1" stopColor="#bb8447"/></radialGradient></defs><path d={shape.path} fill={`url(#${id}-paper)`}/></svg>
     <div className="slice-back-content">
      <div ref={ink} className="result-ink" aria-live="polite" aria-label={phase==='revealed'?result.label:t.yourSecretGift}>{(phase==='revealed'||phase==='vanishing')&&<strong data-ink="true" dir="auto">{result.label}</strong>}</div>
      {size.width>60&&<LockKeyhole className="slice-private-mark" size={15}/>}</div>
    </div>
   </div></div><div className="draw-halo" aria-hidden="true"/>{phase==='vanishing'&&<div className="ink-vapor" aria-hidden="true">{Array.from({length:22},(_,index)=><i key={index} style={{'--vapor-x':`${(index%7-3)*17}px`,'--vapor-delay':`${index%5*35}ms`} as CSSProperties}/>)}</div>}</div>
   <div className="draw-controls"><button className="button primary" onClick={()=>void close()} disabled={closing.current}><ArrowDown size={17}/>{t.keepMySurprise}</button><p>{t.hiddenAfterClose}</p></div>
  </section>
 </div>,document.body);
}
