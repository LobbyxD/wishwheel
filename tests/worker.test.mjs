import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';
import { newToken } from '../server/engine.mjs';
const origin='https://wishwheel.lobbyx3.com';
function fixture(t){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../worker/migrations/0001_rooms.sql',import.meta.url),'utf8'));t.after(()=>sqlite.close());
 return {ALLOWED_ORIGINS:origin,DB:{prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}};}}};
}
function request(body,extra={}) {return new Request('https://example.workers.dev/api/room',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.1',...extra},body:JSON.stringify(body)});}
test('Worker browser preflight permits only exact configured origin and auth headers',async()=>{
 const env={ALLOWED_ORIGINS:origin};
 const good=await worker.fetch(new Request('https://example.workers.dev/api/room',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}}),env);
 assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-origin'),origin);assert.match(good.headers.get('access-control-allow-headers'),/Authorization/);
 for(const hostile of ['https://evil.test',`${origin}.evil.test`,'null']){
  const denied=await worker.fetch(request({action:'create'},{origin:hostile,'x-forwarded-host':new URL(hostile==='null'?'https://evil.test':hostile).host}),env);
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
 }
});
test('Worker with actual SQLite: create/join/start/spin through HTTP retains privacy and CORS',async t=>{
 const env=fixture(t),owner=newToken(),guest=newToken();
 async function call(body,token){const r=await worker.fetch(request(body,{authorization:`Bearer ${token}`}),env);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('access-control-allow-origin'),origin);return r.json();}
 const created=await call({action:'create',name:'Owner',settings:{poolMode:'names',maxMembers:4,turnBased:false,removePicked:true}},owner),code=created.room.code;
 await call({action:'join',name:'Guest',code},guest);
 await call({action:'start',code,generation:1},owner);
 const picked=await call({action:'spin',code,generation:1},guest);assert.equal(picked.me.result.label,'Owner');
 const host=await call({action:'state',code},owner);assert.equal(host.me.result,null);assert.ok(!JSON.stringify(host).includes('assignments'));assert.ok(!JSON.stringify(host).includes('tokenHash'));
 const denied=await worker.fetch(request({action:'state',code},{authorization:`Bearer ${newToken()}`}),env);assert.equal(denied.status,401);
});
test('Worker rejects over-limit streams, malformed JSON, and unavailable storage cleanly',async t=>{
 const env=fixture(t);
 const huge=await worker.fetch(request({action:'create',padding:'a'.repeat(450001)}),env);assert.equal(huge.status,413);
 const bad=await worker.fetch(new Request('https://example.workers.dev/api/room',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{' }),env);assert.equal(bad.status,400);
 const missing=await worker.fetch(request({action:'create',name:'Owner'}),{ALLOWED_ORIGINS:origin});assert.equal(missing.status,503);assert.equal(missing.headers.get('access-control-allow-origin'),origin);assert.ok(!JSON.stringify(await missing.json()).includes('SELECT'));
});
