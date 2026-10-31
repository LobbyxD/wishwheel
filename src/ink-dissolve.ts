import {animateElement} from './draw-motion';

export const INK_ERODE_MS=850;
export const INK_DISSOLVE_MS=1500;
export type InkParticle={x:number;y:number;delay:number;life:number;drift:number;rise:number;size:number;alpha:number};

const random=(value:number)=>{const n=Math.sin(value*127.1+311.7)*43758.5453;return n-Math.floor(n);};

// Emit only from sampled glyph pixels. The spaces between letters never emit.
export function inkParticles(data:Uint8ClampedArray,width:number,height:number):InkParticle[]{
 const pixels:{x:number;y:number;alpha:number}[]=[];
 for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){const alpha=data[(y*width+x)*4+3]/255;if(alpha>.12)pixels.push({x,y,alpha});}
 const stride=Math.max(1,Math.ceil(pixels.length/480));
 return pixels.filter((_,index)=>index%stride===0).map((point,index)=>({
  ...point,delay:80+random(index+1)*720,life:550+random(index+9)*150,
  drift:(random(index+21)-.5)*52,rise:48+random(index+31)*72,size:.35+random(index+41)*.7,
 }));
}

export function inkFrame(elapsed:number,particles:InkParticle[]){
 const erosion=Math.min(1,Math.max(0,elapsed/INK_ERODE_MS));
 return {intercept:2-20*erosion,particles:particles.flatMap(particle=>{
  const age=(elapsed-particle.delay)/particle.life;if(age<=0||age>=1)return [];
  return [{x:particle.x+particle.drift*age+Math.sin(age*7+particle.x)*age*4,y:particle.y-particle.rise*(age*.65+age*age*.35),size:particle.size*(1-age*.55),alpha:particle.alpha*.65*Math.pow(1-age,1.6),age}];
 })};
}

function sampleGlyphs(text:HTMLElement,rect:DOMRect){
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(rect.width));canvas.height=Math.max(1,Math.ceil(rect.height));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 const style=getComputedStyle(text),fontSize=parseFloat(style.fontSize)||16;
 ctx.font=`${style.fontStyle||'normal'} ${style.fontWeight||'600'} ${fontSize}px ${style.fontFamily||'sans-serif'}`;
 ctx.fillStyle=style.color||'#452536';ctx.textBaseline='alphabetic';ctx.direction=style.direction==='rtl'?'rtl':'ltr';ctx.textAlign=ctx.direction==='rtl'?'right':'left';
 const node=text.firstChild,lines:{text:string;top:number;left:number;right:number;height:number}[]=[];
 if(node?.nodeType===Node.TEXT_NODE){
  const value=node.textContent||'',range=document.createRange();
  let offset=0;
  const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)]:Array.from(value).map(segment=>{const part={segment,index:offset};offset+=segment.length;return part;});
  for(const part of segments){
   range.setStart(node,part.index);range.setEnd(node,part.index+part.segment.length);const bounds=range.getBoundingClientRect();if(!bounds.height)continue;
   let line=lines.find(line=>Math.abs(line.top-bounds.top)<2);
   if(!line){line={text:'',top:bounds.top,left:bounds.left,right:bounds.right,height:bounds.height};lines.push(line);}
   line.text+=part.segment;line.left=Math.min(line.left,bounds.left);line.right=Math.max(line.right,bounds.right);
  }
 }
 if(!lines.length)lines.push({text:text.textContent||'',top:rect.top,left:rect.left,right:rect.right,height:rect.height});
 for(const line of lines){
  const metrics=ctx.measureText(line.text),ascent=metrics.fontBoundingBoxAscent||fontSize*.8,descent=metrics.fontBoundingBoxDescent||fontSize*.2;
  ctx.fillText(line.text,(ctx.direction==='rtl'?line.right:line.left)-rect.left,line.top-rect.top+(line.height-ascent-descent)/2+ascent);
 }
 return inkParticles(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
}

export async function dissolveInk({text,cloud,alpha,filterId,signal,reduced=false}:{text:HTMLElement;cloud:HTMLCanvasElement;alpha:SVGFEFuncAElement;filterId:string;signal:AbortSignal;reduced?:boolean}){
 if(signal.aborted)return;
 if(reduced){text.style.visibility='hidden';return;}
 let ctx:CanvasRenderingContext2D|null=null,particles:InkParticle[]|null=null;
 const rect=text.getBoundingClientRect();
 try{ctx=cloud.getContext('2d');if(ctx)particles=sampleGlyphs(text,rect);}catch{/* An unavailable canvas still gets a stationary fade. */}
 if(!ctx||!particles){
  await animateElement(text,[{opacity:1},{opacity:0}],{duration:INK_ERODE_MS,easing:'ease-in',fill:'forwards'},signal);return;
 }
 const paddingX=44,paddingTop=132,ratio=Math.min(window.devicePixelRatio||1,2);
 const width=rect.width+paddingX*2,height=rect.height+paddingTop+8;
 cloud.width=Math.ceil(width*ratio);cloud.height=Math.ceil(height*ratio);
 Object.assign(cloud.style,{left:`${rect.left-paddingX}px`,top:`${rect.top-paddingTop}px`,width:`${width}px`,height:`${height}px`,display:'block'});
 ctx.setTransform(ratio,0,0,ratio,0,0);
 const oldFilter=text.style.filter,oldVisibility=text.style.visibility;
 text.style.filter=`url("#${filterId}")`;alpha.setAttribute('intercept','2');
 await new Promise<void>(resolve=>{
  const started=performance.now();let frame=0,done=false;
  const finish=(complete:boolean)=>{
   if(done)return;done=true;cancelAnimationFrame(frame);signal.removeEventListener('abort',abort);
   text.style.visibility=complete?'hidden':oldVisibility;text.style.filter=oldFilter;
   ctx!.clearRect(0,0,width,height);cloud.style.display='none';resolve();
  };
  const abort=()=>finish(false);signal.addEventListener('abort',abort,{once:true});
  const draw=(now:number)=>{
   if(signal.aborted){finish(false);return;}
   const elapsed=Math.max(0,now-started),state=inkFrame(elapsed,particles!);
   alpha.setAttribute('intercept',String(state.intercept));ctx!.clearRect(0,0,width,height);
   for(const particle of state.particles){
    // Dark ink breaks away from the strokes, lightening subtly as it disperses.
    const lift=particle.age;ctx!.fillStyle=`rgba(${69+Math.round(lift*90)},${37+Math.round(lift*75)},${54+Math.round(lift*85)},${particle.alpha})`;
    ctx!.beginPath();ctx!.arc(paddingX+particle.x,paddingTop+particle.y,particle.size,0,Math.PI*2);ctx!.fill();
   }
   if(elapsed>=INK_DISSOLVE_MS){finish(true);return;}
   frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);
 });
}
