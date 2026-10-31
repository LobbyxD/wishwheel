import {useEffect,useState} from 'react';
import {Check,Copy,KeyRound,LoaderCircle,LockKeyhole,RefreshCw,Send} from 'lucide-react';
import type {IssuedCode,State} from './types';
import {en,he} from './i18n';

export default function InvitationManager({state,busy,onCommand,hebrew=false}:{state:State;busy:boolean;onCommand:(action:'issue-invites'|'regenerate-invite',data:Record<string,unknown>)=>Promise<boolean>;hebrew?:boolean}){
 const t=hebrew?he:en;
 const [codes,setCodes]=useState<Record<string,IssuedCode>>(()=>Object.fromEntries((state.inviteCodes||[]).map(item=>[item.id,item])));
 const [notice,setNotice]=useState(''),[confirm,setConfirm]=useState<string|null>(null);
 const [visibleCount,setVisibleCount]=useState(25);
 useEffect(()=>{if(state.inviteCodes?.length)setCodes(previous=>({...previous,...Object.fromEntries(state.inviteCodes!.map(item=>[item.id,item]))}));},[state.inviteCodes]);
 if(!state.me.isOwner||state.room.settings.participantMode!=='roster')return null;
 const slots=state.invitations||[];
 async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice(t.copied);}catch{setNotice(t.copyCodeManually);}}
 return <section className="panel invitation-manager"><div className="identity-heading"><KeyRound size={20}/><strong>{t.privateInvitations}</strong></div><p className="small muted">{t.privateInvitationsDesc}</p>
  {slots.some(slot=>!slot.hasCode)&&<button className="button secondary issue-codes" disabled={busy} onClick={()=>void onCommand('issue-invites',{})}><KeyRound size={15}/>{t.generateCodes}</button>}
  <div className="invitation-list">{slots.slice(0,visibleCount).map(slot=>{
   const code=slot.hasCode?codes[slot.id]?.code:undefined;
   return <div className="invitation-person" key={slot.id}><div className="invitation-person-heading"><strong>{slot.name}</strong><small>{slot.accountLinked?<><LockKeyhole size={11}/>{t.googleLocked}</>:slot.claimed?t.guestLogin:t.notJoined}</small></div>
    <div className="invitation-code-row"><input readOnly dir="ltr" value={code||'••••••'} aria-label={`${t.personalCode}: ${slot.name}`} onFocus={event=>event.target.select()}/><button className="icon-button" disabled={!code||busy} title={t.copy} aria-label={`${t.copy}: ${slot.name}`} onClick={()=>void copy(code!)}><Copy size={15}/></button><button className="icon-button" disabled={!code||busy} title={t.copyPrivateInvite} aria-label={`${t.copyPrivateInvite}: ${slot.name}`} onClick={()=>void copy(`${slot.name} · ${state.room.settings.title}\n${location.origin}/?room=${state.room.code}#invite=${code}`)}><Send size={15}/></button><button className="text-button" disabled={busy} onClick={()=>setConfirm(slot.id)}><RefreshCw size={13}/>{t.newPrivateCode}</button></div>
    {confirm===slot.id&&<div className="invite-confirm"><p>{slot.accountLinked?t.regenerateGoogleNote:t.regenerateGuestNote}</p><button className="text-button" disabled={busy} onClick={()=>setConfirm(null)}>{t.cancelCodeChange}</button><button className="button secondary" disabled={busy} onClick={async()=>{if(await onCommand('regenerate-invite',{slotId:slot.id})){setConfirm(null);setNotice(t.newCodeReady);}}}>{busy?<LoaderCircle size={13} className="loading"/>:<Check size={13}/>} {t.generateNewCode}</button></div>}
   </div>;
  })}</div>{slots.length>visibleCount&&<button className="text-button" onClick={()=>setVisibleCount(value=>value+25)}>{t.showMorePeople} ({slots.length-visibleCount})</button>}
  <p className="small muted code-memory-note">{t.codeMemoryNote}</p>{notice&&<p className="upload-success" role="status">{notice}</p>}
 </section>;
}
