import {useEffect, useState} from 'react';
import {Check, ListChecks, LoaderCircle, LockKeyhole, Users} from 'lucide-react';
import {en, he} from './i18n';
import {request,savedRooms} from './api';
import {message} from './errors';
import type {RoomPreview, Settings, State} from './types';

export const rosterLines = (text: string) => text.split('\n').map(name => name.trim()).filter(Boolean);

export function RosterFields({settings, text, onText, onMode, hebrew = false}: {
 settings: Settings; text: string; onText: (text: string) => void; onMode: (mode: Settings['participantMode']) => void; hebrew?: boolean;
}) {
 const t = hebrew ? he : en;
 return <div className="roster-fields"><span className="field-label">{t.participantMode}</span>
  <div className="choice-grid roster-choices">{(['open','roster'] as const).map(mode => <button type="button" key={mode} className={`choice ${settings.participantMode === mode ? 'chosen' : ''}`} aria-pressed={settings.participantMode === mode} onClick={() => onMode(mode)}>
   {mode === 'roster' ? <ListChecks size={22} /> : <Users size={22} />}<strong>{mode === 'roster' ? t.listedGuests : t.openGuests}</strong><small>{mode === 'roster' ? t.listedGuestsDesc : t.openGuestsDesc}</small>
  </button>)}</div>
  {settings.participantMode === 'roster' && <label>{t.rosterNames}<textarea value={text} onChange={event => onText(event.target.value)} rows={5} maxLength={2000} placeholder={'Alice\nBob\nCarol'} required /><small className="muted">{t.rosterHint} · {rosterLines(text).length}/50</small></label>}
 </div>;
}

export function IdentityInput({name, onChange, roster, hebrew = false}: {name: string; onChange: (name: string) => void; roster?: string[]; hebrew?: boolean}) {
 const t = hebrew ? he : en;
 return <label>{roster ? t.chooseIdentity : t.yourName}{roster ? <select required value={name} onChange={event => onChange(event.target.value)}><option value="">{t.chooseName}</option>{roster.map((person,index) => <option key={`${person}-${index}`} value={person}>{person}</option>)}</select> : <input autoComplete="given-name" maxLength={32} required value={name} onChange={event => onChange(event.target.value)} placeholder={t.namePlaceholder} />}</label>;
}

export function JoinIdentityFields({code, onCode, name, onName, onReady, onReturn, hebrew = false}: {
 code: string; onCode: (code: string) => void; name: string; onName: (name: string) => void; onReady: (ready: boolean) => void; onReturn:(code:string,token:string)=>void;hebrew?: boolean;
}) {
 const t = hebrew ? he : en;
 const [preview, setPreview] = useState<RoomPreview | null>(null);
 const [loading, setLoading] = useState(false), [error, setError] = useState('');
 const remembered=savedRooms().find(room=>room.code===code);
 useEffect(() => {
  const controller = new AbortController();
  setPreview(null);setError('');onReady(false);
  if (!/^[A-Z2-9]{6}$/.test(code)) {setLoading(false);return;}
  setLoading(true);
  const timer = setTimeout(() => {
   void request<RoomPreview>('preview','',{code},controller.signal).then(room => {
    if(controller.signal.aborted)return;
    setPreview(room);onReady(room.phase==='lobby');
    if(room.participantMode==='roster')onName('');
   }).catch(cause => {if(!controller.signal.aborted)setError(message(cause,hebrew));})
    .finally(() => {if(!controller.signal.aborted)setLoading(false);});
  },250);
  return () => {clearTimeout(timer);controller.abort();};
 },[code,hebrew,onName,onReady]);
 return <div className="join-identity-fields">
  <label>{t.roomCode}<input className="code-input" dir="ltr" autoCapitalize="characters" maxLength={6} required value={code} onChange={event => {onCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));onReady(false);}} placeholder="ABC234" /></label>
  {loading && <p className="roster-loading" role="status"><LoaderCircle size={15} className="loading" />{t.lookupRoom}</p>}
  {error && <p className="upload-error" role="alert">{error}</p>}
  {preview && <><div className="invitation-preview"><strong>{preview.title}</strong><small>{preview.memberCount}/{preview.maxMembers} · {t[preview.phase]}</small></div>
   {remembered&&<button type="button" className="button secondary remembered-return" onClick={()=>onReturn(remembered.code,remembered.token)}><Check size={16}/>{t.resumeRoom} · {remembered.name}</button>}
   {preview.phase!=='lobby' ? <p className="soft-note"><LockKeyhole size={16} />{t.identityLocked} {t.returnHint}</p> : preview.participantMode==='roster' ? <>
    <label>{t.chooseIdentity}<select value={name} onChange={event => onName(event.target.value)} required><option value="">{t.chooseName}</option>{preview.people.map(person => <option key={person.name} value={person.name} disabled={person.claimed}>{person.name}{person.claimed?` — ${t.claimed}`:''}</option>)}</select></label>
    <p className="small muted">{preview.people.every(person=>person.claimed)?t.allSlotsTaken:t.identityEditable}</p>
   </> : <IdentityInput name={name} onChange={onName} hebrew={hebrew} />}
  </>}
  {!preview&&!loading&&!error&&<p className="small muted">{t.selectRoomFirst}</p>}
  <p className="small muted">{t.returnHint}</p>
 </div>;
}

export function RoomIdentity({state,onChange,busy,hebrew=false}:{state:State;onChange:(name:string)=>void;busy:boolean;hebrew?:boolean}) {
 const t=hebrew?he:en,{room,me}=state;
 if(room.settings.participantMode!=='roster')return null;
 const unclaimed=room.settings.roster.filter(name=>!room.members.some(member=>member.name===name));
 return <section className="panel room-identity"><div className="identity-heading">{room.phase==='lobby'?<ListChecks size={20}/>:<LockKeyhole size={20}/>}<strong>{room.phase==='lobby'?t.chooseIdentity:t.identityLocked}</strong></div>
  {room.phase==='lobby'&&<><label>{t.changeIdentity}<select value={me.name} disabled={busy} onChange={event=>onChange(event.target.value)}>{room.settings.roster.map(name=><option key={name} value={name} disabled={name!==me.name&&room.members.some(member=>member.name===name)}>{name}</option>)}</select></label>
   <p className="small muted">{t.identityEditable}</p><div className="roster-claim-progress"><Check size={14}/>{room.members.length}/{room.settings.roster.length} {t.rosterProgress}</div>
   {unclaimed.length>0&&<div className="unclaimed-roster"><span>{t.notJoined}</span>{unclaimed.map(name=><small key={name}>{name}</small>)}</div>}
  </>}
 </section>;
}
