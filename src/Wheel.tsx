import {useEffect, useId, useMemo, useState} from 'react';
import type {CSSProperties} from 'react';
import {Bell, Gift, Heart, Music2, Snowflake, Star, TreePine} from 'lucide-react';
import type {Item, Settings} from './types';
import {useAnimatedSlices} from './useAnimatedSlices';

const colors = ['#f3dfbb', '#e0b66b', '#214e47', '#f5e2bf', '#ac2243', '#dfb269', '#214e47', '#ad2042'];
const decorativeIcons = [TreePine, Star, Gift, Heart, Snowflake, Bell, Music2, Gift];
const placeholders = {
 en: ['Noah', 'Olivia', 'Liam', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Emma'],
 he: ['נועם', 'מיה', 'אורי', 'אלה', 'איתי', 'שירה', 'דניאל', 'מאיה']
};

function slicePath(start: number, end: number) {
 const span=end-start;
 if (span >= 359.999) return 'M 200 27 A 173 173 0 1 1 200 373 A 173 173 0 1 1 200 27 Z';
 if(span<.001)return 'M 200 200 Z';
 const a = (start - 90) * Math.PI / 180;
 const b = (end - 90) * Math.PI / 180;
 return `M 200 200 L ${200 + 173 * Math.cos(a)} ${200 + 173 * Math.sin(a)} A 173 173 0 ${span > 180 ? 1 : 0} 1 ${200 + 173 * Math.cos(b)} ${200 + 173 * Math.sin(b)} Z`;
}

export default function Wheel({items, spinning, result, hidden = false, settings, decorative = false, hebrew = false}: {
 items: Item[]; spinning: boolean; result: Item | null; hidden?: boolean;
 settings?: Settings; decorative?: boolean; hebrew?: boolean;
}) {
 const id = useId().replace(/:/g, '');
 const display = useMemo(() => items.length ? items : placeholders[hebrew ? 'he' : 'en'].map((label, i) => ({id: String(i + 1), label})), [items, hebrew]);
 const count = display.length;
 const {arcs,slicing,added}=useAnimatedSlices(display.map(item=>item.id));
 const step = 360 / count;
 const selectedIndex = result ? display.findIndex(item => item.id === result.id) : -1;
 const [rotation, setRotation] = useState(0);
 const [popped, setPopped] = useState(false);
 const target = selectedIndex >= 0 ? (360 - (selectedIndex + 0.5) * step) % 360 : 0;

 useEffect(() => {
  if (selectedIndex < 0) { setPopped(false); setRotation(0); return; }
  if (spinning) {
   setPopped(false);
   setRotation(previous => previous + (360 - previous % 360) + 1800 + target);
   const timer = setTimeout(() => setPopped(true), 4900);
   return () => clearTimeout(timer);
  }
  setRotation(previous => Math.floor(previous / 360) * 360 + target);
  setPopped(true);
 }, [spinning, result?.id, selectedIndex, target]);

 const imageCover = hidden && settings?.coverType === 'image';
 return <div className={`wheel-stage ${decorative ? 'decorative' : ''} ${spinning ? 'is-spinning' : ''} ${popped ? 'has-winner' : ''} ${slicing?'is-slicing':''}`}
  aria-label={hidden ? (hebrew ? 'גלגל מסתורי' : 'Mystery wheel') : (hebrew ? 'גלגל ההגרלה' : 'Roulette wheel')}>
  <div className="wheel-orbit orbit-one" /><div className="wheel-orbit orbit-two" />
  <span className="wheel-star star-one" aria-hidden="true">✦</span><span className="wheel-star star-two" aria-hidden="true">✧</span><span className="wheel-star star-three" aria-hidden="true">✦</span>
  <div className="wheel-pointer" /><div className="wheel-shadow" />
  <div className="wheel-disc" style={{transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4.8s cubic-bezier(.12,.65,.12,1)' : 'none'}}>
   <svg viewBox="0 0 400 400" role="img" aria-label={`${hidden ? (hebrew ? 'גלגל מכוסה' : 'Covered wheel') : (hebrew ? 'גלגל שמות' : 'Name wheel')} · ${count} ${hebrew ? 'פלחים' : 'slices'}`}>
    <defs>
     <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fbe6a5" /><stop offset=".25" stopColor="#a46a2f" /><stop offset=".5" stopColor="#e8ba69" /><stop offset=".8" stopColor="#8b5327" /><stop offset="1" stopColor="#ffeab5" /></linearGradient>
     {display.map((item, index) => {const arc=arcs.get(item.id)||{start:360,end:360};return <clipPath id={`${id}-slice-${index}`} key={item.id}><path d={slicePath(arc.start,arc.end)} /></clipPath>;})}
    </defs>
    <circle cx="200" cy="200" r="195" fill={`url(#${id}-rim)`} /><circle cx="200" cy="200" r="190" fill="#5a3020" stroke="#f5d38b" strokeWidth="1.5" /><circle cx="200" cy="200" r="178" fill={`url(#${id}-rim)`} />
    {display.map((item, index) => {
     const winner = popped && selectedIndex === index;
     const arc=arcs.get(item.id)||{start:360,end:360};
     const midpoint=(arc.start+arc.end)/2;
     const angle = (midpoint - 90) * Math.PI / 180;
     const x = 200 + 107 * Math.cos(angle), y = 200 + 107 * Math.sin(angle);
     const path = slicePath(arc.start,arc.end);
     const DecorativeIcon = decorativeIcons[index % decorativeIcons.length];
     return <g key={item.id} data-wheel-slice={index} className={`${winner ? 'winning-slice' : 'wheel-slice'} ${added.has(item.id)?'joining-slice':''}`}
      style={{transform: winner ? `translate(${Math.cos(angle) * 19}px,${Math.sin(angle) * 19}px)` : 'translate(0,0)'}}>
      <path d={path} fill={hidden ? settings?.coverColor || '#a82643' : colors[index % colors.length]} />
      {imageCover && <image href={settings.coverImage || '/assets/holiday-scene.webp'} x="27" y="27" width="346" height="346"
       preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-slice-${index})`} />}
      <path d={path} fill="none" stroke={winner ? '#ffe1a1' : '#e9c687'} strokeWidth={winner ? 4 : imageCover ? 2.5 : 1} />
      {!hidden && <text x={x} y={y - (decorative ? 9 : 0)} transform={decorative ? undefined : `rotate(${midpoint} ${x} ${y})`} textAnchor="middle" dominantBaseline="middle"
       fill={[2,4,6,7].includes(index % colors.length) ? '#fff9ef' : '#492b25'} fontSize={decorative ? 16 : count > 20 ? 7 : count > 12 ? 9 : 12} fontWeight={decorative ? '400' : '600'} fontFamily={decorative ? 'Georgia,serif' : undefined}>
       {item.label.length > 17 ? item.label.slice(0, 15) + '…' : item.label}
      </text>}
      {decorative && <DecorativeIcon x={x - 8} y={y + 6} width={16} height={16} strokeWidth={1.5} color={[2,4,6,7].includes(index % colors.length) ? '#f1d49d' : '#a57b41'} />}
     </g>;
    })}
    {Array.from({length: 28}, (_, index) => <circle className="wheel-bulb" key={index} cx={200 + 184 * Math.cos(index * Math.PI / 14)} cy={200 + 184 * Math.sin(index * Math.PI / 14)} r="3.2" style={{animationDelay: `${-index * .17}s`}} />)}
   </svg>
  </div>
  <div className="wheel-hub"><Star size={29} strokeWidth={1.1} fill="#f5d18e" /></div>
  {popped && <div className="winner-sparkles" aria-hidden="true">✦<span>✧</span>✦</div>}
  {popped && <div className="winner-confetti" aria-hidden="true">{Array.from({length:18},(_,index)=><span key={index} style={{'--confetti-x':`${(index-8.5)*22}px`,'--confetti-r':`${index*47}deg`,animationDelay:`${index*.025}s`} as CSSProperties}>{index%3?'✦':'❄'}</span>)}</div>}
 </div>;
}
