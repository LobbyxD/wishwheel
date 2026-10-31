import {useEffect,useState} from 'react';
import {authEndpoint} from './deployment';

export type GoogleUser={id:string;name:string;email:string;provider:'google'};
type AuthState={loading:boolean;user:GoogleUser|null;clientId:string;nonce:string;unavailable:boolean};
let state:AuthState={loading:true,user:null,clientId:'',nonce:'',unavailable:false};
let initializing:Promise<void>|null=null;
const listeners=new Set<(next:AuthState)=>void>();
function publish(next:AuthState){state=next;for(const listener of listeners)listener(next);}
async function authRequest(path:string,credential?:string){
 const response=await fetch(`${authEndpoint}/${path}`,{credentials:'same-origin',...(path==='session'?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credential?{credential}:{})})});
 const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Sign-in failed.');return body;
}
export async function refreshAccount(){
 try{const body=await authRequest('session');publish({loading:false,user:body.user,clientId:body.clientId,nonce:body.nonce,unavailable:false});}
 catch{publish({loading:false,user:null,clientId:'',nonce:'',unavailable:true});}
}
export function useAccount(){
 const [value,setValue]=useState(state);
 useEffect(()=>{listeners.add(setValue);setValue(state);initializing??=refreshAccount();return()=>{listeners.delete(setValue);};},[]);
 return value;
}
export async function signInWithGoogle(credential:string){await authRequest('google',credential);await refreshAccount();}
export async function continueAsGuest(){await authRequest('logout');window.google?.accounts.id.disableAutoSelect();localStorage.setItem('ww.loginChoice','guest');await refreshAccount();}

type GoogleAccounts={accounts:{id:{initialize(options:{client_id:string;nonce:string;callback:(response:{credential:string})=>void;auto_select:boolean;use_fedcm_for_button:boolean}):void;renderButton(element:HTMLElement,options:{theme:string;size:string;text:string;shape:string;width:number}):void;disableAutoSelect():void}}};
declare global{interface Window{google?:GoogleAccounts}}
let script:Promise<void>|null=null;
export function loadGoogleButton(){
 if(window.google)return Promise.resolve();
 if(!script)script=new Promise<void>((resolve,reject)=>{
  const element=document.createElement('script');element.src='https://accounts.google.com/gsi/client';element.async=true;
  element.onload=()=>resolve();element.onerror=()=>{element.remove();script=null;reject(new Error('Google sign-in is unavailable.'));};document.head.append(element);
 });return script;
}
