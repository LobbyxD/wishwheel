import {useEffect,useRef,useState} from 'react';
import {Check,LoaderCircle,LogOut,ShieldCheck,UserRound} from 'lucide-react';
import {continueAsGuest,loadGoogleButton,refreshAccount,signInWithGoogle,useAccount} from './auth';
import {en,he} from './i18n';

export default function AccountPanel({hebrew=false,onBeforeLogout}:{hebrew?:boolean;onBeforeLogout:()=>void}){
 const t=hebrew?he:en,account=useAccount(),container=useRef<HTMLDivElement>(null),working=useRef(false);
 const [expanded,setExpanded]=useState(()=>localStorage.getItem('ww.loginChoice')!=='guest'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!expanded||account.loading||account.user||!account.clientId||!container.current)return;
  let cancelled=false;
  void loadGoogleButton().then(()=>{
   if(cancelled||!container.current||!window.google)return;
   container.current.replaceChildren();
   window.google.accounts.id.initialize({client_id:account.clientId,nonce:account.nonce,auto_select:false,use_fedcm_for_button:true,callback:response=>{
    if(working.current||cancelled)return;working.current=true;setBusy(true);setError('');
    void signInWithGoogle(response.credential).then(()=>{localStorage.setItem('ww.loginChoice','google');}).catch(()=>{setError(t.googleFailed);void refreshAccount();}).finally(()=>{working.current=false;setBusy(false);});
   }});
   window.google.accounts.id.renderButton(container.current,{theme:'outline',size:'large',text:'continue_with',shape:'pill',width:Math.min(260,Math.max(180,container.current.clientWidth))});
  }).catch(()=>{if(!cancelled)setError(t.googleFailed);});
  return()=>{cancelled=true;};
 },[expanded,account.loading,account.user?.id,account.clientId,account.nonce,hebrew]);
 async function guest(){
  if(working.current)return;working.current=true;setBusy(true);setError('');
  try{if(account.user)onBeforeLogout();await continueAsGuest();setExpanded(false);}catch{setError(t.googleFailed);}finally{working.current=false;setBusy(false);}
 }
 return <section className="account-panel" aria-label={t.accountChoice}>
  {account.loading?<span className="account-status"><LoaderCircle size={15} className="loading"/>{t.accountLoading}</span>:account.user?<>
   <div className="account-person"><span className="account-avatar">{account.user.name.slice(0,1).toUpperCase()}</span><span><strong>{account.user.name}</strong><small><ShieldCheck size={12}/>{t.googleSignedIn}</small></span></div>
   <button className="text-button" disabled={busy} onClick={()=>void guest()}><LogOut size={14}/>{t.signOut}</button>
  </>:expanded?<>
   <div className="account-intro"><strong>{t.accountChoice}</strong><small>{t.accountChoiceDesc}</small></div>
   <div className="account-options">{account.clientId?<div ref={container} className="google-button"/>:<span className="small muted">{t.googleUnavailable}</span>}<button className="button secondary" disabled={busy} onClick={()=>void guest()}>{busy?<LoaderCircle size={15} className="loading"/>:<UserRound size={15}/>} {t.continueGuest}</button></div>
  </>:<><span className="account-status"><UserRound size={15}/>{t.guestLogin}<Check size={13}/></span><button className="text-button" onClick={()=>setExpanded(true)}>{t.signInGoogle}</button></>}
  {error&&<p className="upload-error" role="alert">{error}</p>}
 </section>;
}
