import {useRef, useState} from 'react';
import {ArrowRight, Download, FolderHeart, Import, LockKeyhole, Search, ShieldCheck} from 'lucide-react';
import {downloadRecoveryFile, importRecoveryFile, savedRooms} from './api';
import type {Saved} from './api';
import {en, he} from './i18n';

export default function RoomLibrary({rooms,busy,onRestore,hebrew=false}:{rooms:Saved[];busy:boolean;onRestore:(room:Saved)=>void;hebrew?:boolean}) {
 const t=hebrew?he:en;
 const [imported,setImported]=useState<Saved[]|null>(null),[filter,setFilter]=useState<'all'|'hosted'|'joined'>('all'),[search,setSearch]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const file=useRef<HTMLInputElement>(null);
 const all=imported||rooms;
 const visible=all.filter(room=>(filter==='all'||filter==='hosted'&&room.isOwner||filter==='joined'&&!room.isOwner)&&`${room.title} ${room.code} ${room.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 async function importFile(input?:File){
  if(!input)return;
  setError('');setNotice('');
  try{if(input.size>2_000_000)throw new Error();importRecoveryFile(await input.text());setImported(savedRooms());setNotice(t.backupImported);}
  catch{setError(t.invalidBackup);}
 }
 return <section className="room-library" aria-label={t.roomLibrary}>
  <div className="section-heading"><h2><FolderHeart size={23}/>{t.roomLibrary}</h2><div className="library-actions"><button className="text-button" disabled={!all.length} onClick={()=>downloadRecoveryFile(all)}><Download size={15}/>{t.backupRooms}</button><button className="text-button" onClick={()=>file.current?.click()}><Import size={15}/>{t.importRooms}</button></div></div>
  <p className="library-help"><LockKeyhole size={14}/>{t.libraryHelp}</p>
  <input type="file" className="accessible-file" ref={file} accept="application/json,.json" aria-label={t.importRooms} onChange={event=>{const selected=event.currentTarget.files?.[0];event.currentTarget.value='';void importFile(selected);}}/>
  {notice&&<p className="upload-success" role="status">{notice}</p>}{error&&<p className="upload-error" role="alert">{error}</p>}
  {all.length>0&&<><div className="library-toolbar"><div className="segmented">{(['all','hosted','joined']as const).map(value=><button key={value} className={filter===value?'on':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?t.allRooms:value==='hosted'?t.hostedRooms:t.joinedRooms}</button>)}</div><label className="library-search"><Search size={15}/><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={t.roomSearch} aria-label={t.roomSearch}/></label></div>
   <div className="recent-grid library-grid">{visible.map(room=><button key={room.code} onClick={()=>onRestore(room)} disabled={busy}><span className="mini-icon"><FolderHeart size={22}/></span><span><strong>{room.title}</strong><small>{room.isOwner?t.owner:t.guest} · {room.name} · {room.code}</small><small>{new Date(room.updated).toLocaleDateString(hebrew?'he-IL':'en-US')}</small></span><ArrowRight size={18} className="direction-arrow"/></button>)}</div>
   {!visible.length&&<p className="small muted library-empty">{t.libraryEmpty}</p>}
  </>}
 </section>;
}

export function RoomMemory({room,hebrew=false}:{room:Saved;hebrew?:boolean}) {
 const t=hebrew?he:en;
 return <section className="private-card room-memory"><ShieldCheck size={23}/><h3>{t.rememberTitle}</h3><p>{t.rememberNote}</p><button className="button secondary" onClick={()=>downloadRecoveryFile([room])}><Download size={15}/>{t.recoveryFile}</button><p className="recovery-privacy"><LockKeyhole size={12}/>{t.recoveryPrivacy}</p></section>;
}
