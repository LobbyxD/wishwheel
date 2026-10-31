import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createWorker} from '../worker/index.mjs';

const secret='disposable-local-monitor-secret';
const url='https://wishwheel.test/api/keep-alive';
const migration=readFileSync(new URL('../worker/migrations/0003_keep_alive.sql',import.meta.url),'utf8').replace(/^--.*$/gm,'').replace(/\n/g,' ');
const missingRow={error:'Keep-alive row not found',hint:'Run the seed SQL: INSERT INTO keep_alive (id) VALUES (1);'};
function request(authorization=`Bearer ${secret}`,method='GET') {
 return new Request(url,{method,headers:authorization===null?{}:{Authorization:authorization}});
}
async function expectJSON(response,status,body) {
 assert.equal(response.status,status);
 assert.match(response.headers.get('content-type'),/application\/json/);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.match(response.headers.get('vary'),/Authorization/);
 assert.deepEqual(await response.json(),body);
}

test('keep-alive authenticates exact bearer headers before accessing storage',async()=>{
 const worker=createWorker(()=>{throw new Error('must not open room storage');});
 const env={get DB(){throw new Error('must not access database');}};
 await expectJSON(await worker.fetch(request(),env),500,{error:'KEEP_ALIVE_SECRET is not configured on the server'});
 env.KEEP_ALIVE_SECRET=secret;
 for(const header of [null,'',secret,`bearer ${secret}`,`Bearer wrong`,`Bearer ${secret} extra`]) {
  await expectJSON(await worker.fetch(request(header),env),401,{error:'Unauthorized'});
 }
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) {
  const response=await worker.fetch(request(undefined,method),env);
  assert.equal(response.headers.get('allow'),'GET');
  await expectJSON(response,405,{error:'Method not allowed'});
 }
 await expectJSON(await worker.fetch(request(),env),500,{error:'Database update failed'});
 await expectJSON(await worker.fetch(request(),{KEEP_ALIVE_SECRET:secret}),500,{error:'Database update failed'});
});

test('keep-alive in real Worker runtime writes only row 1, returns persisted timestamp and handles database errors', {timeout:30000},async t=>{
 const bundle=buildSync({entryPoints:[fileURLToPath(new URL('../worker/index.mjs',import.meta.url))],bundle:true,platform:'neutral',format:'esm',external:['node:*'],write:false});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'keep-alive-test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],durableObjects:{ROOM_LIVE:{className:'RoomLive',useSQLite:true}},bindings:{KEEP_ALIVE_SECRET:secret}}]}));
 t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 async function call(header=`Bearer ${secret}`) {
  return mf.dispatchFetch(url,{headers:header?{Authorization:header}:{}});
 }
 // No ALLOWED_ORIGINS or room tables: machine monitoring uses only its own secret.
 await expectJSON(await call(),500,{error:'Database update failed'});
 await db.exec(migration);
 await db.prepare('INSERT INTO keep_alive (id,last_updated) VALUES (2,?)').bind('untouched').run();
 const before=Date.now(),response=await call();
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),/no-store/);
 const body=await response.json();
 assert.deepEqual(Object.keys(body).sort(),['ok','updated_at']);
 assert.equal(body.ok,true);
 assert.equal(new Date(body.updated_at).toISOString(),body.updated_at);
 assert.ok(Date.parse(body.updated_at)>=before&&Date.parse(body.updated_at)<=Date.now());
 assert.equal((await db.prepare('SELECT last_updated FROM keep_alive WHERE id=1').first()).last_updated,body.updated_at);
 assert.equal((await db.prepare('SELECT last_updated FROM keep_alive WHERE id=2').first()).last_updated,'untouched');
 await expectJSON(await call('Bearer wrong'),401,{error:'Unauthorized'});
 assert.equal((await db.prepare('SELECT last_updated FROM keep_alive WHERE id=1').first()).last_updated,body.updated_at);
 // Re-applying setup must preserve a successful health-check timestamp.
 await db.exec(migration);
 assert.equal((await db.prepare('SELECT last_updated FROM keep_alive WHERE id=1').first()).last_updated,body.updated_at);
 await db.exec('DELETE FROM keep_alive WHERE id=1');
 await expectJSON(await call(),404,missingRow);
 assert.equal(await db.prepare('SELECT id FROM keep_alive WHERE id=1').first(),null);
 await db.exec('DROP TABLE keep_alive');
 await expectJSON(await call(),500,{error:'Database update failed'});
});

test('frontend exposes the exact keep-alive path through its Worker proxy',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const route=config.rewrites.find(route=>route.source==='/api/keep-alive');
 assert.equal(route?.destination,'https://wishwheel.daniel1233212.workers.dev/api/keep-alive');
});
