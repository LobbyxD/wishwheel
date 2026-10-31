export const WHEEL_SPIN_MS=4800;
export const DRAW_REVEAL_MS=5000;

export type Rect={left:number;top:number;width:number;height:number};
type Point={x:number;y:number};

export function wheelSlicePath(start:number,end:number){
 const span=end-start;
 if(span>=359.999)return 'M 200 27 A 173 173 0 1 1 200 373 A 173 173 0 1 1 200 27 Z';
 if(span<.001)return 'M 200 200 Z';
 const a=(start-90)*Math.PI/180,b=(end-90)*Math.PI/180;
 return `M 200 200 L ${200+173*Math.cos(a)} ${200+173*Math.sin(a)} A 173 173 0 ${span>180?1:0} 1 ${200+173*Math.cos(b)} ${200+173*Math.sin(b)} Z`;
}

// Fit by changing font size only. Never widen glyphs or apply scaleX/textLength.
export function naturalFontSize(fits:(size:number)=>boolean,min=8,max=36){
 let best=min,low=min,high=max;
 while(low<=high){const size=Math.floor((low+high)/2);if(fits(size)){best=size;low=size+1;}else high=size-1;}
 return best;
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
 return {left,top,width,height,polygon,rectangle,path:wheelSlicePath(-180/size,180/size)};
}

export function sliceSource(wheel:Rect,count:number):Rect{
 const slice=landedSlice(count);
 const side=Math.min(wheel.width,wheel.height);
 return {left:wheel.left+(wheel.width-side)/2+side*slice.left/400,top:wheel.top+(wheel.height-side)/2+side*slice.top/400,width:side*slice.width/400,height:side*slice.height/400};
}

export function sliceRevealSize(count:number,viewport:{width:number;height:number}){
 const shape=landedSlice(count),compact=viewport.height<=650;
 // Enlarge the same square wheel canvas uniformly, rather than magnifying a
 // wide sector's cropped bounds until it dominates the screen.
 const canvas=Math.max(1,Math.min(compact?340:480,viewport.width-64,compact?viewport.height-170:viewport.height*.49));
 const scale=canvas/400;
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
