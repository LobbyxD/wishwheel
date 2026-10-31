import {useLayoutEffect,useRef,useState} from 'react';
import type {RefObject} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,Gift,LockKeyhole,Sparkles,X} from 'lucide-react';
import {animateElement,landedSlice,rectTransform,sliceSource} from './draw-motion';
import type {Item,Settings} from './types';
import {en,he} from './i18n';

export default function DrawReveal({result,count,index,settings,wheel,destination,onDock,hebrew=false,reduced=false}:{
 result:Item;count:number;index:number;settings:Settings;wheel:RefObject<HTMLDivElement|null>;destination:RefObject<HTMLElement|null>;onDock:()=>void;hebrew?:boolean;reduced?:boolean;
}){
 const t=hebrew?he:en,shape=landedSlice(count);
 const [phase,setPhase]=useState<'arriving'|'revealed'|'vanishing'|'docking'>('arriving');
 const ticket=useRef<HTMLDivElement>(null),flipper=useRef<HTMLDivElement>(null),back=useRef<HTMLDivElement>(null),ink=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const lifetime=useRef(new AbortController()),intro=useRef(new AbortController()),closing=useRef(false),closeAction=useRef(()=>{});
 const onDockRef=useRef(onDock);onDockRef.current=onDock;
 const image= settings.wheelHidden&&settings.coverType==='image';
 const color=settings.wheelHidden?settings.coverColor:['#f3dfbb','#e0b66b','#214e47','#f5e2bf','#ac2243','#dfb269','#214e47','#ad2042'][Math.max(index,0)%8];
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
   animateElement(piece,[{transform:rectTransform(start,piece.getBoundingClientRect()),opacity:.3},{transform:'translate(0,-16px) scale(1.06)',opacity:1,offset:.75},{transform:'none',opacity:1}],{duration:reducedMotion?0:650,easing:'cubic-bezier(.16,.8,.24,1)',fill:'both'},signal),
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
  const words=ink.current?.querySelectorAll('span')||[];
  await Promise.all([...words].map((word,index)=>animateElement(word,[{opacity:1,filter:'blur(0)',transform:'translateY(0)'},{opacity:0,filter:'blur(12px)',transform:`translate(${index%2?14:-14}px,-18px) scale(.8)`}],{duration:reduce?0:420,delay:reduce?0:Math.min(index*35,140),easing:'ease-in',fill:'forwards'},signal)));
  if(signal.aborted)return;
  setPhase('docking');
  // Scroll behind the fixed dialog first so the destination is visible on phones.
  document.body.style.overflow='';destination.current?.scrollIntoView({behavior:'instant',block:'center'});
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  if(signal.aborted)return;
  const target=destination.current?.getBoundingClientRect(),origin=piece.getBoundingClientRect();
  await Promise.all([
   animateElement(back.current!,[{clipPath:shape.polygon,borderRadius:'0'},{clipPath:shape.rectangle,borderRadius:'18px'}],{duration:reduce?0:650,easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'},signal),
   animateElement(piece,[{transform:'none',opacity:1},{transform:target?rectTransform(target,origin):'translateY(100px) scale(.7)',opacity:1,offset:.9},{transform:target?rectTransform(target,origin):'translateY(100px) scale(.7)',opacity:0}],{duration:reduce?0:850,easing:'cubic-bezier(.32,.04,.16,1)',fill:'forwards'},signal),
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
   <div className="draw-ticket-space"><div ref={ticket} className="draw-ticket"><div ref={flipper} className="draw-flipper">
    <div className="slice-face slice-front" style={{clipPath:shape.polygon,background:color}} aria-hidden="true">
     {image&&<svg viewBox={`${shape.left} ${shape.top} ${shape.width} ${shape.height}`} preserveAspectRatio="none"><g transform={`rotate(${-((Math.max(index,0)+.5)*360/Math.max(count,1))} 200 200)`}><image href={settings.coverImage||'/assets/holiday-scene.webp'} x="27" y="27" width="346" height="346" preserveAspectRatio="xMidYMid slice"/></g></svg>}
     <div className="slice-front-magic"><Gift size={46} strokeWidth={1}/><span>✦</span></div>
    </div>
    <div ref={back} className="slice-face slice-back" style={{clipPath:shape.polygon}}>
     <div className="slice-back-content"><Gift size={26} strokeWidth={1.3}/><span className="slice-eyebrow">{t.yourSecretGift}</span>
      <div ref={ink} className="result-ink" aria-live="polite">{(phase==='revealed'||phase==='vanishing')&&<strong dir="auto">{result.label.split(/(\s+)/).map((word,index)=>/^\s+$/.test(word)?word:<span key={index}>{word}</span>)}</strong>}</div>
      <LockKeyhole size={14}/>
     </div>
    </div>
   </div></div><div className="draw-halo" aria-hidden="true"/></div>
   <div className="draw-controls"><button className="button primary" onClick={()=>void close()} disabled={closing.current}><ArrowDown size={17}/>{t.keepMySurprise}</button><p>{t.hiddenAfterClose}</p></div>
  </section>
 </div>,document.body);
}
