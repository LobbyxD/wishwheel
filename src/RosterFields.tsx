import {useEffect,useLayoutEffect,useRef,useId,useState} from 'react';
import {Check,ListChecks,LoaderCircle,LockKeyhole,Plus,Users,X} from 'lucide-react';
import {en, he} from './i18n';
import {request,savedRooms,makeToken} from './api';
import {message} from './errors';
import type {RoomPreview, Settings, State} from './types';

export const rosterValues=(names:string[])=>names.map(name=>name.trim()).filter(Boolean);

export function RosterFields({settings,names,onNames,onMode,hebrew=false}: {
 settings:Settings;names:string[];onNames:(names:string[])=>void;onMode:(mode:Settings['participantMode'])=>void;hebrew?:boolean;
}) {
 const t = hebrew ? he : en;
 const container=useRef<HTMLDivElement>(null),focusIndex=useRef<number|null>(null),id=useId();
 useLayoutEffect(()=>{if(focusIndex.current!==null){container.current?.querySelectorAll('input')[focusIndex.current]?.focus();focusIndex.current=null;}},[names.length]);
 return <div className="roster-fields"><span className="field-label">{t.participantMode}</span>
  <div className="choice-grid roster-choices">{(['open','roster'] as const).map(mode => <button type="button" key={mode} className={`choice ${settings.participantMode === mode ? 'chosen' : ''}`} aria-pressed={settings.participantMode === mode} onClick={() => onMode(mode)}>
   {mode === 'roster' ? <ListChecks size={22} /> : <Users size={22} />}<strong>{mode === 'roster' ? t.listedGuests : t.openGuests}</strong><small>{mode === 'roster' ? t.privateRosterDesc : t.openGuestsDesc}</small>
  </button>)}</div>
  {settings.participantMode==='roster'&&<fieldset className="roster-editor"><legend>{t.guestNames}</legend><p className="small muted">{t.guestNamesHint}</p><div className="roster-inputs" ref={container}>{names.map((name,index)=><div className="roster-input-row" key={index}>
   <label htmlFor={`${id}-${index}`}>{t.guest} {index+1}</label><input id={`${id}-${index}`} value={name} autoComplete="off" maxLength={32} required placeholder={t.namePlaceholder} onChange={event=>onNames(names.map((value,position)=>position===index?event.target.value:value))} onPaste={event=>{const pasted=event.clipboardData.getData('text').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);if(pasted.length>1){event.preventDefault();onNames([...names.slice(0,index),...pasted,...names.slice(index+1)]);}}}/>
   <button type="button" className="icon-button" disabled={names.length<=2} aria-label={`${t.removePerson} ${index+1}`} onClick={()=>{focusIndex.current=Math.max(0,index-1);onNames(names.filter((_,position)=>position!==index));}}><X size={16}/></button>
  </div>)}</div><button type="button" className="button secondary add-person" onClick={()=>{focusIndex.current=names.length;onNames([...names,'']);}}><Plus size={17}/>{t.addAnother}</button><p className="small muted">{rosterValues(names).length} {t.peopleReady} · {t.includeHost}</p></fieldset>}
 </div>;
}

export function IdentityInput({name, onChange, roster, hebrew = false}: {name: string; onChange: (name: string) => void; roster?: string[]; hebrew?: boolean}) {
 const t = hebrew ? he : en;
 return <label>{roster ? t.chooseIdentity : t.yourName}{roster ? <select required value={name} onChange={event => onChange(event.target.value)}><option value="">{t.chooseName}</option>{roster.map((person,index) => <option key={`${person}-${index}`} value={person}>{person}</option>)}</select> : <input autoComplete="given-name" maxLength={32} required value={name} onChange={event => onChange(event.target.value)} placeholder={t.namePlaceholder} />}</label>;
}

export function JoinIdentityFields({code, onCode, name, onName, onReady, onReturn, personalCode, onPersonalCode,onPrivateNeeded,hebrew = false}: {
 code: string; onCode: (code: string) => void; name: string; onName: (name: string) => void; onReady: (ready: boolean) => void; onReturn:(code:string,token:string)=>void;personalCode:string;onPersonalCode:(code:string)=>void;onPrivateNeeded:(needed:boolean)=>void;hebrew?: boolean;
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
    setPreview(room);onPrivateNeeded(!!room.requiresPersonalCode);onReady(room.phase==='lobby'||!!room.requiresPersonalCode);
    if(room.canResume)onReturn(code,savedRooms().find(saved=>saved.code===code)?.token||makeToken());
    if(room.requiresPersonalCode)onName('');
   }).catch(cause => {if(!controller.signal.aborted)setError(message(cause,hebrew));})
    .finally(() => {if(!controller.signal.aborted)setLoading(false);});
  },250);
  return () => {clearTimeout(timer);controller.abort();};
 },[code,hebrew,onName,onReady,onPrivateNeeded]);
 return <div className="join-identity-fields">
  <label>{t.roomCode}<input className="code-input" dir="ltr" autoCapitalize="characters" maxLength={6} required value={code} onChange={event => {onCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));onPersonalCode('');onReady(false);}} placeholder="ABC234" /></label>
  {loading && <p className="roster-loading" role="status"><LoaderCircle size={15} className="loading" />{t.lookupRoom}</p>}
  {error && <p className="upload-error" role="alert">{error}</p>}
  {preview && <><div className="invitation-preview"><strong>{preview.title}</strong><small>{preview.memberCount}/{preview.maxMembers} · {t[preview.phase]}</small></div>
   {remembered&&<button type="button" className="button secondary remembered-return" onClick={()=>onReturn(remembered.code,remembered.token)}><Check size={16}/>{t.resumeRoom} · {remembered.name}</button>}
   {preview.canResume?<p className="soft-note"><LockKeyhole size={16}/>{t.resumeGoogle}</p>:preview.requiresPersonalCode?<><label>{t.personalCode}<input className="code-input" dir="ltr" value={personalCode} onChange={event=>onPersonalCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={6} autoComplete="off" autoCapitalize="characters" placeholder="A7B2CD" required/></label><p className="small muted">{t.personalCodeHint}</p></>:preview.phase!=='lobby'?<p className="soft-note"><LockKeyhole size={16}/>{t.identityLocked} {t.returnHint}</p>:<IdentityInput name={name} onChange={onName} hebrew={hebrew}/>}
  </>}
  {!preview&&!loading&&!error&&<p className="small muted">{t.selectRoomFirst}</p>}
  <p className="small muted">{t.returnHint}</p>
 </div>;
}

export function RoomIdentity({state,hebrew=false}:{state:State;onChange?:(name:string)=>void;busy?:boolean;hebrew?:boolean}) {
 const t=hebrew?he:en,{room,me}=state;
 if(room.settings.participantMode!=='roster')return null;
 const joinedNames=new Set(room.members.map(member=>member.name)),unclaimed=room.settings.roster.filter(name=>!joinedNames.has(name));
 return <section className="panel room-identity"><div className="identity-heading"><LockKeyhole size={20}/><strong>{me.name} · {me.accountLinked?t.googleLocked:t.codeIdentity}</strong></div><p className="small muted">{me.accountLinked?t.googleIdentityNote:t.guestIdentityNote}</p>
  {room.phase==='lobby'&&<><div className="roster-claim-progress"><Check size={14}/>{room.members.length}/{room.settings.roster.length} {t.rosterProgress}</div>
   {unclaimed.length>0&&<div className="unclaimed-roster"><span>{t.notJoined}</span>{unclaimed.slice(0,25).map(name=><small key={name}>{name}</small>)}{unclaimed.length>25&&<small>+{unclaimed.length-25}</small>}</div>}
  </>}
 </section>;
}
