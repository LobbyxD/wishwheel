import {useEffect,useMemo,useRef,useState} from 'react';

export type SliceArc={start:number;end:number};
export function sliceArcs(ids:string[]):Map<string,SliceArc>{
 return new Map(ids.map((id,index)=>[id,{start:index*360/ids.length,end:(index+1)*360/ids.length}]));
}
export function interpolateSlices(previous:Map<string,SliceArc>,target:Map<string,SliceArc>,progress:number){
 return new Map([...target].map(([id,to])=>{
  const from=previous.get(id)||{start:360,end:360};
  return [id,{start:from.start+(to.start-from.start)*progress,end:from.end+(to.end-from.end)*progress}];
 }));
}
export function useAnimatedSlices(ids:string[]){
 const signature=ids.join('\0');
 const target=useMemo(()=>sliceArcs(ids),[signature]);
 const [arcs,setArcs]=useState(target),[slicing,setSlicing]=useState(false),[added,setAdded]=useState<Set<string>>(()=>new Set());
 const current=useRef(target),previousSignature=useRef(signature);
 useEffect(()=>{
  if(previousSignature.current===signature)return;
  previousSignature.current=signature;
  const previous=current.current;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
  if(reduced()){current.current=target;setArcs(target);setSlicing(false);setAdded(new Set());return;}
  setAdded(new Set([...target.keys()].filter(id=>!previous.has(id))));setSlicing(true);
  const start=performance.now();let frame:number;
  const tick=(now:number)=>{
   const progress=reduced()?1:Math.min(1,(now-start)/720);
   const next=interpolateSlices(previous,target,1-Math.pow(1-progress,3));
   current.current=next;setArcs(next);
   if(progress<1)frame=requestAnimationFrame(tick);
   else{setSlicing(false);setAdded(new Set());}
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[signature,target]);
 return {arcs,slicing,added};
}
