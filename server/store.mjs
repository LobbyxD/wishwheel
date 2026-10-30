import { AppError, fail } from './engine.mjs';

export class SupabaseStore {
  constructor(url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!url || !key) fail('NOT_CONFIGURED','The room service is not configured yet. Please try again later.',503);
    this.url=url.replace(/\/$/,''); this.key=key;
  }
  async request(path, options={}) {
    let response;
    try {
      response=await fetch(`${this.url}/rest/v1/${path}`,{...options,headers:{apikey:this.key,...(this.key.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${this.key}`}),'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(12000)});
    } catch { throw new AppError('SERVICE_UNAVAILABLE','The room service is temporarily unavailable. Please retry.',503); }
    const data=await response.json().catch(()=>null);
    if (!response.ok) {
      if(response.status===409 && data?.code==='23505') throw new AppError('CONFLICT','Room already exists.',409);
      // Never send database errors, query details, or credentials to the browser.
      throw new AppError('SERVICE_UNAVAILABLE','The room service is temporarily unavailable. Please retry.',503);
    }
    return data;
  }
  async read(code) { const rows=await this.request(`wishwheel_rooms?code=eq.${encodeURIComponent(code)}&select=state,revision`); return rows[0]||null; }
  async byOwner(hash) { const rows=await this.request(`wishwheel_rooms?owner_hash=eq.${hash}&select=state,revision`); return rows[0]||null; }
  async insert(state,ownerHash) { return this.request('wishwheel_rooms',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({code:state.code,owner_hash:ownerHash,state})}); }
  async cas(code,revision,state) { return this.request('rpc/wishwheel_cas',{method:'POST',body:JSON.stringify({p_code:code,p_revision:revision,p_state:state})}); }
  async rate(bucket,limit,seconds) { return this.request('rpc/wishwheel_rate_limit',{method:'POST',body:JSON.stringify({p_bucket:bucket,p_limit:limit,p_seconds:seconds})}); }
}
