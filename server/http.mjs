import { createHash } from 'node:crypto';
import { AppError, hashToken, validToken } from './engine.mjs';
import { roomService } from './service.mjs';

export function createHandler(createStore,account=null,onMutation=null) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Authorization, Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST'); return res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'Use GET or POST.'}});}
  try {
    // Browser mutations must be same-origin; capability headers prevent CSRF.
    const origin=req.headers.origin;
    const host=req.headers['x-forwarded-host']||req.headers.host;
    if(origin && new URL(origin).host!==host) throw new AppError('ORIGIN_REJECTED','This request must come from Wishwheel.',403);
    if(req.method==='POST' && !String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) throw new AppError('INVALID_BODY','Send JSON request data.',415);
    let input=req.method==='GET'?{action:'state',code:req.query?.code}:req.body;
    if(typeof input==='string') {if(Buffer.byteLength(input)>450000) throw new AppError('TOO_LARGE','That request is too large.',413); input=JSON.parse(input);}
    if(!input || typeof input!=='object' || Array.isArray(input) || Buffer.byteLength(JSON.stringify(input))>450000) throw new AppError('INVALID_BODY','Invalid room request.',400);
    if(req.method==='POST' && !input.action) throw new AppError('INVALID_ACTION','Choose a room action.',400);
    const auth=req.headers.authorization;
    const token=typeof auth==='string' && auth.startsWith('Bearer ')?auth.slice(7):null;
    const store=createStore();
    const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const bucket=createHash('sha256').update(`wishwheel:${ip}`).digest('hex');
    if(!await store.rate(`ip:${bucket}`,1200,60)) throw new AppError('RATE_LIMITED','Too many requests. Please wait a minute.',429);
    if(input.action==='join'&&input.inviteCode&&!await store.rate(`invite:${bucket}:${String(input.code).trim().toUpperCase()}`,60,600)) throw new AppError('RATE_LIMITED','Too many private-code attempts. Please wait a few minutes.',429);
    if(account&&!await store.rate(`account:${input.action==='state'?'read':'write'}:${hashToken(account.id)}:${String(input.code||'create')}`,input.action==='state'?90:45,60)) throw new AppError('RATE_LIMITED','Too many requests. Please wait a minute.',429);
    if(validToken(token) && !await store.rate(`session:${input.action==='state'?'read':'write'}:${hashToken(token)}`,input.action==='state'?90:45,60)) throw new AppError('RATE_LIMITED','Too many requests. Please wait a minute.',429);
    if(input.action==='create' && !await store.rate(`create:${bucket}`,15,3600)) throw new AppError('RATE_LIMITED','Too many rooms created. Please try again later.',429);
    const result=await roomService(store,input,token,Date.now(),account);
    if(onMutation&&!['state','preview'].includes(input.action))try{await onMutation(result,input);}catch{/* The committed result stays valid; clients retain a polling fallback. */}
    return res.status(200).json(result);
  } catch(error) {
    const expected=error instanceof AppError;
    if(expected && error.status===429) res.setHeader('Retry-After','60');
    return res.status(expected?error.status:400).json({error:{code:expected?error.code:'INVALID_REQUEST',message:expected?error.message:'The room request could not be processed.'}});
  }
}
}

