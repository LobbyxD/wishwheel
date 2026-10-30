import {useEffect,useRef,useState} from 'react';
import {ArrowRight, Check, CheckCircle2, Clock, LoaderCircle, RefreshCw, Sparkles, Users, UserRoundMinus} from 'lucide-react';
import type {Member,State} from './types';
import {en, he} from './i18n';

export function TurnBanner({state, hebrew = false}: {state: State; hebrew?: boolean}) {
 const t = hebrew ? he : en;
 const {room, me} = state;
 if (room.phase === 'lobby') return null;
 const picked = room.members.filter(member => member.status === 'picked').length;
 const current = room.members.find(member => member.id === room.turnMemberId);
 const myTurn = current?.id === me.id;
 const complete = room.phase === 'complete';
 return <section className={`turn-banner ${myTurn ? 'my-turn' : ''} ${complete ? 'round-complete' : ''}`} aria-label={t.roundProgress}>
  <div className="turn-banner-main" role="status" aria-live="polite">
   <span className="turn-banner-icon">{complete ? <CheckCircle2 /> : current?.status === 'picking' ? <LoaderCircle className="loading" /> : <Sparkles />}</span>
   <div><span className="turn-kicker">{complete ? t.complete : room.settings.turnBased ? t.currentTurn : t.active}</span>
    <strong>{complete ? t.allPicked : current ? `${current.name}${myTurn ? ` · ${t.youAreNext}` : ''}` : t.anyoneCanSpin}</strong>
    {!complete && <small>{current?.status === 'picking' ? t.spinning : myTurn ? t.readyToSpin : room.settings.turnBased ? t.waitSub : t.privateNote}</small>}
   </div>
   {current && <span className="turn-number">{t.turnLabel} {(room.turnOrder || []).indexOf(current.id) + 1} / {room.members.length}</span>}
  </div>
  <div className="round-progress"><span>{picked} / {room.members.length} {t.pickedCount}</span><span>{t.privateNote}</span></div>
  <div className="round-progress-track" role="progressbar" aria-label={t.roundProgress} aria-valuenow={picked} aria-valuemin={0} aria-valuemax={room.members.length}><div style={{width: `${picked / room.members.length * 100}%`}} /></div>
 </section>;
}

export function GuestList({state, hebrew = false, onRefresh, onKick, busy=false}: {state: State; hebrew?: boolean; onRefresh: () => void; onKick?:(id:string)=>Promise<boolean>;busy?:boolean}) {
 const t = hebrew ? he : en;
 const {room, me} = state;
 const [removing,setRemoving]=useState<Member|null>(null);
 const order = room.phase !== 'lobby' && room.settings.turnBased ? room.turnOrder || [] : [];
 const members = order.length ? order.map(id => room.members.find(member => member.id === id)).filter(member => member !== undefined) : room.members;
 return <section className="panel guest-panel">
  <div className="section-heading"><h2>{t.members}</h2><span className="count-pill"><Users size={12} />{room.members.length}/{room.settings.maxMembers}</span></div>
  {order.length > 0 && <p className="queue-caption">{t.queue}</p>}
  <div className="guest-list">{members.map((member, index) => {
   const current = room.phase === 'active' && room.turnMemberId === member.id;
   const ready = member.status === 'waiting' && room.phase === 'active' && (!room.settings.turnBased || current);
   const next = room.phase === 'active' && room.settings.turnBased && member.status === 'waiting' && !current && order.indexOf(member.id) === order.indexOf(room.turnMemberId || '') + 1;
   const status = member.status === 'picked' ? t.picked : member.status === 'picking' ? t.picking : room.phase === 'lobby' ? t.joinedStatus : ready ? member.id === me.id ? t.youAreNext : t.readyToSpin : next ? t.upNext : t.waitingForTurn;
   return <div className={`guest-row ${current ? 'current-player' : ''}`} key={member.id} aria-current={current ? 'step' : undefined}>
    {order.length > 0 && <span className="queue-position">{member.status === 'picked' ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span>}
    <div className={`avatar avatar-${index % 5}`}>{member.name.trim().slice(0, 1).toUpperCase()}{member.status === 'picked' && <Check size={10} />}</div>
    <div className="guest-name"><strong>{member.name} {member.id === me.id && <small>({t.you})</small>}</strong><small>{member.id === room.ownerId ? t.owner : t.guest}</small></div>
    <span className={`status status-${ready ? 'ready' : member.status}`}>
     {member.status === 'picked' ? <CheckCircle2 size={13} /> : member.status === 'picking' ? <LoaderCircle className="loading" size={13} /> : ready ? <ArrowRight size={13} className="direction-arrow" /> : <Clock size={12} />}{status}
    </span>
    {me.isOwner&&member.id!==me.id&&onKick&&<button className="kick-button" disabled={busy} onClick={()=>setRemoving(member)} aria-label={`${t.kick}: ${member.name}`} title={t.kick}><UserRoundMinus size={15}/></button>}
   </div>;
  })}</div>
  <div className="auto-update"><span className="live-dot" />{t.online}<button onClick={onRefresh} aria-label={t.refresh}><RefreshCw size={13} /></button></div>
  {removing&&onKick&&<KickDialog member={removing} active={room.phase!=='lobby'} busy={busy} hebrew={hebrew} onCancel={()=>setRemoving(null)} onConfirm={async()=>{if(await onKick(removing.id))setRemoving(null);}}/>}
 </section>;
}

function KickDialog({member,active,busy,hebrew,onCancel,onConfirm}:{member:Member;active:boolean;busy:boolean;hebrew:boolean;onCancel:()=>void;onConfirm:()=>Promise<void>}) {
 const t=hebrew?he:en,cancel=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;cancel.current?.focus();
  return()=>previous?.focus();
 },[]);
 return <div className="modal-overlay" onClick={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}><section className="modal kick-dialog" role="dialog" aria-modal="true" aria-labelledby="kick-title" onKeyDown={event=>{
  if(event.key==='Escape'&&!busy)onCancel();
  if(event.key==='Tab'){event.preventDefault();(document.activeElement===cancel.current?confirm:cancel).current?.focus();}
 }}>
  <span className="modal-icon"><UserRoundMinus/></span><h2 id="kick-title">{t.kickTitle}</h2><strong>{member.name}</strong><p>{t.kickLobby}</p>{active&&<p className="kick-warning">{t.kickRound}</p>}
  <button ref={cancel} className="button secondary" disabled={busy} onClick={onCancel}>{t.keepGuest}</button><button ref={confirm} className="button primary" disabled={busy} onClick={()=>void onConfirm()}>{busy?<LoaderCircle size={16} className="loading"/>:<UserRoundMinus size={16}/>} {t.confirmKick}</button>
 </section></div>;
}
