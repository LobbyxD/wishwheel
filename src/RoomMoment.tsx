import {useEffect,useRef,useState} from 'react';
import {Gift,LockKeyhole,Sparkles,Star} from 'lucide-react';
import type {CSSProperties} from 'react';
import type {State} from './types';
import {nextActivity,publicPlayers} from './room-activity';
import type {Activity,PublicPlayer} from './room-activity';
import {en,he} from './i18n';

export function useRoomMoment(state:State|null){
 const [moment,setMoment]=useState<Activity|null>(null);
 const seen=useRef<{scope:string;people:PublicPlayer[]}|null>(null);
 useEffect(()=>{
  if(!state||state.room.phase==='lobby'){seen.current=null;setMoment(null);return;}
  const scope=`${state.room.code}:${state.room.generation}:${state.me.id}`;
  const people=publicPlayers(state.room.members),same=seen.current?.scope===scope;
  const activity=nextActivity(same?seen.current!.people:null,people,state.me.id,state.room.serverNow??Date.now());
  seen.current={scope,people};
  if(!same)setMoment(activity);else if(activity)setMoment(activity);
 },[state]);
 useEffect(()=>{
  if(!moment)return;
  const timer=setTimeout(()=>setMoment(current=>current?.key!==moment.key?current:moment.phase==='picking'?{...moment,phase:'celebrating',remaining:0}:null),moment.phase==='picking'?moment.remaining:4500);
  return()=>clearTimeout(timer);
 },[moment]);
 return moment;
}

export default function RoomMoment({moment,hebrew=false}:{moment:Activity|null;hebrew?:boolean}){
 const t=hebrew?he:en;
 if(!moment)return null;
 const names=moment.people.slice(0,3).join(hebrew?' ו־':', '),others=moment.people.length>3?` +${moment.people.length-3}`:'';
 return <section className={`room-moment ${moment.phase}`} key={`${moment.key}:${moment.phase}`} aria-label={t.sharedMoment}>
  <div className="moment-fireworks" aria-hidden="true">{Array.from({length:16},(_,index)=><i key={index} style={{'--ray':`${index*22.5}deg`,'--delay':`${index%4*.09}s`} as CSSProperties}><Star size={index%3?8:13} fill="currentColor"/></i>)}</div>
  <span className="moment-gift" aria-hidden="true"><Gift size={31} strokeWidth={1.3}/><Sparkles size={17}/></span>
  <div role="status" aria-live="polite"><strong>{names}{others} · {moment.phase==='picking'?t.sharedSpinning:t.sharedPicked}</strong><p>{moment.phase==='picking'?t.sharedCheer:t.sharedWrapped}</p></div>
  <span className="moment-private"><LockKeyhole size={12}/>{t.sharedPrivate}</span>
 </section>;
}
