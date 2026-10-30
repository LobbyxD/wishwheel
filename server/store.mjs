import { AppError, fail } from './engine.mjs';

// D1 bindings execute on the primary (no read-replica sessions). State and
// revision are read together; conditional writes never overwrite a newer round.
export class D1Store {
  constructor(db) {
    if (!db?.prepare) fail('NOT_CONFIGURED','The room service is not configured yet. Please try again later.',503);
    this.db=db;
  }
  async query(sql, values=[], method='first') {
    try { return await this.db.prepare(sql).bind(...values)[method](); }
    catch { throw new AppError('SERVICE_UNAVAILABLE','The room service is temporarily unavailable. Please retry.',503); }
  }
  decode(row) { return row?{state:JSON.parse(row.state),revision:row.revision}:null; }
  async read(code) { return this.decode(await this.query('SELECT state, revision FROM wishwheel_rooms WHERE code = ?', [code])); }
  async byOwner(hash) { return this.decode(await this.query('SELECT state, revision FROM wishwheel_rooms WHERE owner_hash = ?', [hash])); }
  async insert(state,ownerHash) {
    const result=await this.query('INSERT INTO wishwheel_rooms (code, owner_hash, state) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',[state.code,ownerHash,JSON.stringify(state)],'run');
    if(result.meta.changes!==1) throw new AppError('CONFLICT','Room already exists.',409);
  }
  async cas(code,revision,state) {
    const result=await this.query('UPDATE wishwheel_rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?',[JSON.stringify(state),code,revision],'run');
    return result.meta.changes===1;
  }
  async rate(bucket,limit,seconds) {
    const now=Math.floor(Date.now()/1000);
    const row=await this.query(`INSERT INTO wishwheel_limits (bucket, count, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(bucket) DO UPDATE SET
        count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
        expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
      RETURNING count`,[bucket,now+seconds,now,now]);
    return row.count<=limit;
  }
  async cleanup() { await this.query('DELETE FROM wishwheel_limits WHERE expires_at <= ?', [Math.floor(Date.now()/1000)],'run'); }
}
