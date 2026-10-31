export const WHEEL_SPIN_MS=4800;
export const DRAW_REVEAL_MS=6000;

export type Rect={left:number;top:number;width:number;height:number};
type Point={x:number;y:number};

// The landed slice faces twelve o'clock. Normalize its actual outline so the
// extracted piece can grow without losing the wheel's image crop or geometry.
export function landedSlice(count:number){
 const size=Math.max(1,Math.min(100,Math.floor(count)||1)),half=Math.PI/size;
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
 return {left:wheel.left+wheel.width*slice.left/400,top:wheel.top+wheel.height*slice.top/400,width:wheel.width*slice.width/400,height:wheel.height*slice.height/400};
}

export function rectTransform(from:Rect,to:Rect){
 if(!from.width||!from.height||!to.width||!to.height)return 'none';
 return `translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${from.width/to.width},${from.height/to.height})`;
}

export function animateElement(element:Element,keyframes:Keyframe[],options:KeyframeAnimationOptions,signal?:AbortSignal):Promise<void>{
 if(signal?.aborted)return Promise.resolve();
 if(!('animate' in element))return Promise.resolve();
 const animation=element.animate(keyframes,options);
 const cancel=()=>animation.cancel();signal?.addEventListener('abort',cancel,{once:true});
 return animation.finished.then(()=>{},()=>{}).finally(()=>signal?.removeEventListener('abort',cancel));
}
