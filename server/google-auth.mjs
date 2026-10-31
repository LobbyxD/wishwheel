import {createRemoteJWKSet,jwtVerify} from 'jose';
import {AppError,hashToken,newToken,validToken,fail} from './engine.mjs';

const GOOGLE_KEYS=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const SESSION='ww_google_session',NONCE='ww_google_nonce';
const SESSION_SECONDS=30*24*60*60;

export async function verifyGoogleCredential(credential,clientId,nonce,keys=GOOGLE_KEYS){
 if(!clientId)fail('AUTH_NOT_CONFIGURED','Google sign-in is not configured yet.',503);
 if(!validToken(nonce)||typeof credential!=='string'||credential.length>12000)fail('GOOGLE_SIGN_IN_FAILED','Please try signing in with Google again.',401);
 try{
  const {payload}=await jwtVerify(credential,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],requiredClaims:['sub','iat','exp','nonce'],clockTolerance:5,maxTokenAge:'1h'});
  if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||payload.nonce!==nonce)throw new Error('Invalid identity');
  return {id:`google:${payload.sub}`,provider:'google',name:typeof payload.name==='string'?payload.name.slice(0,128):'Google account',email:payload.email_verified===true&&typeof payload.email==='string'?payload.email.slice(0,254):''};
 }catch{fail('GOOGLE_SIGN_IN_FAILED','Google sign-in could not be verified. Please try again.',401);}
}
function cookies(request){return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(value=>value.trim().split('=')).filter(parts=>parts.length===2));}
function cookieName(request,name){return `${new URL(request.url).protocol==='https:'?'__Host-':''}${name}`;}
function cookie(request,name,value,maxAge,path='/'){
 return `${cookieName(request,name)}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
function json(body,headers=new Headers()){
 headers.set('Content-Type','application/json; charset=utf-8');headers.set('Cache-Control','private, no-store, max-age=0');headers.set('Vary','Cookie');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
 return new Response(JSON.stringify(body),{headers});
}
export async function readAccount(request,store,now=Date.now()){
 const token=cookies(request)[cookieName(request,SESSION)];if(!validToken(token))return null;
 const session=await store.sessionRead(hashToken(token));
 return session&&session.expiresAt>now?session.account:null;
}
export async function handleAuth(request,env,store,verify=verifyGoogleCredential){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(origin&&origin!==(env.APP_ORIGIN||url.origin))fail('ORIGIN_REJECTED','This request must come from Wishwheel.',403);
 const jar=cookies(request),headers=new Headers(),clientId=env.GOOGLE_CLIENT_ID||'',sessionName=cookieName(request,SESSION),nonceName=cookieName(request,NONCE);
 if(url.pathname==='/api/auth/session'&&request.method==='GET'){
  const nonce=validToken(jar[nonceName])?jar[nonceName]:newToken();
  if(nonce!==jar[nonceName])headers.append('Set-Cookie',cookie(request,NONCE,nonce,600));
  const user=await readAccount(request,store);
  return json({user,clientId,nonce},headers);
 }
 if(request.method!=='POST')throw new AppError('METHOD_NOT_ALLOWED','Use GET for session or POST to sign in/out.',405);
 if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))fail('INVALID_BODY','Send JSON request data.',415);
 if(url.pathname==='/api/auth/logout'){
  const token=jar[sessionName];if(validToken(token))await store.sessionDelete(hashToken(token));
  headers.append('Set-Cookie',cookie(request,SESSION,'',0));headers.append('Set-Cookie',cookie(request,NONCE,'',0));
  return json({user:null},headers);
 }
 if(url.pathname!=='/api/auth/google')fail('NOT_FOUND','Not found.',404);
 const bucket=hashToken(`google:${request.headers.get('CF-Connecting-IP')||'local'}`);
 if(store.rate&&!await store.rate(`google-login:${bucket}`,30,300))fail('RATE_LIMITED','Too many sign-in attempts. Please wait a few minutes.',429);
 const raw=await request.text();if(raw.length>16000)fail('INVALID_BODY','Invalid sign-in request.');
 let input;try{input=JSON.parse(raw);}catch{fail('INVALID_BODY','Invalid sign-in request.');}
 const account=await verify(input?.credential,clientId,jar[nonceName]);
 const token=newToken(),now=Date.now();
 await store.sessionInsert(hashToken(token),{account,expiresAt:now+SESSION_SECONDS*1000});
 const previous=jar[sessionName];if(validToken(previous))await store.sessionDelete(hashToken(previous));
 headers.append('Set-Cookie',cookie(request,SESSION,token,SESSION_SECONDS));headers.append('Set-Cookie',cookie(request,NONCE,'',0));
 return json({user:account},headers);
}
