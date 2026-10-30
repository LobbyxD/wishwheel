import type {CSSProperties} from 'react';
import {Snowflake, Sparkle} from 'lucide-react';

const snowflakes = Array.from({length: 32}, (_, index) => ({
 left: (index * 37 + 7) % 100,
 size: 9 + (index * 13) % 28,
 duration: 16 + index % 7 * 3,
 delay: -((index * 7) % 38),
 sway: (index % 2 ? -1 : 1) * (35 + index % 5 * 18)
}));

export default function FestiveAtmosphere() {
 return <div className="festive-atmosphere" aria-hidden="true">
  <div className="christmas-glow glow-left" /><div className="christmas-glow glow-right" />
  <svg className="fairy-lights" viewBox="0 0 1440 64" preserveAspectRatio="none">
   <path className="light-cable" d="M-240 12 Q-120 55 0 12 Q120 55 240 12 Q360 55 480 12 Q600 55 720 12 Q840 55 960 12 Q1080 55 1200 12 Q1320 55 1440 12 Q1560 55 1680 12" />
   {Array.from({length: 30}, (_, index) => {
    const x = index * 50 + 10, progress = (x % 240) / 240;
    const y = 12 + 86 * progress * (1 - progress);
    return <g key={index} transform={`translate(${x},${y})`}>
     <path d="M0 0v9" stroke="#ad813f" strokeWidth="1.3" /><rect x="-2.8" y="7" width="5.6" height="4" rx="1" fill="#b99758" />
     <ellipse className={`fairy-bulb bulb-${index % 3}`} cx="0" cy="15" rx="3.7" ry="5.5" style={{animationDelay: `${-index * 0.43}s`}} />
    </g>;
   })}
  </svg>
  <img className="hanging-ornaments" src="/assets/christmas-ornaments.png" width="1295" height="1214" alt="" decoding="async" />
  <div className="snowfall actual-snowflakes">{snowflakes.map((flake, index) => <span key={index} className={`snowflake snowflake-depth-${index % 3}`} style={{
   left: `${flake.left}%`, width: flake.size, height: flake.size,
   animationDuration: `${flake.duration}s`, animationDelay: `${flake.delay}s`, '--snow-sway': `${flake.sway}px`, '--snow-spin': `${index % 2 ? 220 : -190}deg`
  } as CSSProperties}><Snowflake strokeWidth={1.1} /></span>)}</div>
  <Snowflake className="frost-decoration frost-left" strokeWidth={0.7} /><Snowflake className="frost-decoration frost-right" strokeWidth={0.7} />
  <div className="christmas-stardust">{Array.from({length: 16}, (_, index) => <Sparkle key={index} size={index % 3 ? 5 : 11} style={{left: `${(index * 23 + 4) % 100}%`, top: `${12 + (index * 17) % 82}%`, animationDelay: `${-index * 0.7}s`}} />)}</div>
 </div>;
}
