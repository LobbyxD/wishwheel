export const WHEEL_SPIN_MS=4800;
export const DRAW_REVEAL_MS=5000;

export type Rect={left:number;top:number;width:number;height:number};
type Point={x:number;y:number};

export function fitSliceLabel(label:string,width=420,height=230){
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
 const glyphs=(text:string)=>segmenter?[...segmenter.segment(text)].map(part=>part.segment):Array.from(text);
 const words=label.split(/\s+/).map(glyphs);
 for(let fontSize=110;fontSize>=12;fontSize--){
  const capacity=Math.max(1,Math.floor(width/(fontSize*.68))),lines:string[]=[];
  let line='';
  for(const word of words){
   const letters=[...word];
   if(line&&Array.from(line).length+letters.length+1>capacity){lines.push(line);line='';}
   while(letters.length>capacity){if(line){lines.push(line);line='';}lines.push(letters.splice(0,capacity).join(''));}
   if(letters.length)line+=(line?' ':'')+letters.join('');
  }
  if(line)lines.push(line);
  if(lines.length*fontSize*1.2<=height||fontSize===12)return {fontSize,lines:lines.map(text=>({text,width:Math.min(width,[...text].length*fontSize*.68)}))};
 }
 return {fontSize:12,lines:[{text:label,width}]};
}

// The landed slice faces twelve o'clock. Normalize its actual outline so the
// extracted piece can grow without losing the wheel's image crop or geometry.
export function landedSlice(count:number){
 const size=Math.max(1,Math.floor(count)||1),half=Math.PI/size;
 const points:Point[]=size===1?[]:[{x:200,y:200}];
 for(let index=0;index<=64;index++){
  const angle=-Math.PI/2-half+index/64*half*2;
  points.push({x:200+173*Math.cos(angle),y:200+173*Math.sin(angle)});
 }
 const left=Math.min(...points.map(point=>point.x)),top=Math.min(...points.map(point=>point.y));
 const width=Math.max(...points.map(point=>point.x))-left,height=Math.max(...points.map(point=>point.y))-top;
 const polygon=`polygon(${points.map(point=>`${((point.x-left)/width*100).toFixed(4)}% ${((point.y-top)/height*100).toFixed(4)}%`).join(',')})`;
 const rectangle=`polygon(${points.map((_,index)=>{
  // Equal vertex counts let browsers interpolate the slice into a rectangle.
  const distance=index/(points.length-1)*4;
  const x=distance<=1?0:distance<=2?(distance-1)*100:distance<=3?100:(4-distance)*100;
  const y=distance<=1?(1-distance)*100:distance<=2?0:distance<=3?(distance-2)*100:100;
  return `${x.toFixed(4)}% ${y.toFixed(4)}%`;
 }).join(',')})`;
 return {left,top,width,height,polygon,rectangle};
}

export function sliceSource(wheel:Rect,count:number):Rect{
 const slice=landedSlice(count);
 const side=Math.min(wheel.width,wheel.height);
 return {left:wheel.left+(wheel.width-side)/2+side*slice.left/400,top:wheel.top+(wheel.height-side)/2+side*slice.top/400,width:side*slice.width/400,height:side*slice.height/400};
}

export function sliceRevealSize(count:number,viewport:{width:number;height:number}){
 const shape=landedSlice(count),compact=viewport.height<=650;
 const maxWidth=Math.max(1,Math.min(compact?340:560,viewport.width-64));
 const maxHeight=Math.max(1,compact?viewport.height-170:Math.min(viewport.height*.49,420));
 const scale=Math.min(maxWidth/shape.width,maxHeight/shape.height);
 return {width:shape.width*scale,height:shape.height*scale};
}

export function rectTransform(from:Rect,to:Rect,preserveAspect=false){
 if(!from.width||!from.height||!to.width||!to.height)return 'none';
 const scaleX=from.width/to.width,scaleY=from.height/to.height;
 return `translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${preserveAspect?Math.min(scaleX,scaleY):`${scaleX},${scaleY}`})`;
}

export function animateElement(element:Element,keyframes:Keyframe[],options:KeyframeAnimationOptions,signal?:AbortSignal):Promise<void>{
 if(signal?.aborted)return Promise.resolve();
 if(!('animate' in element))return Promise.resolve();
 const animation=element.animate(keyframes,options);
 const cancel=()=>animation.cancel();signal?.addEventListener('abort',cancel,{once:true});
 return animation.finished.then(()=>{},()=>{}).finally(()=>signal?.removeEventListener('abort',cancel));
}
