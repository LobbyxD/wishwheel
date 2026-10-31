import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {D1Store} from '../server/store.mjs';
import {LocalFileStore} from '../server/local-store.mjs';
const {DatabaseSync}=await import('node:sqlite').catch(()=>({DatabaseSync:null}));

test('D1 migrations and session persistence run against SQLite with expiry cleanup and revocation',{skip:!DatabaseSync&&'Built-in SQLite is unavailable in this Node runtime; run on Node 22.13+.'},async()=>{
 const database=new DatabaseSync(':memory:');
 try{
  for(const migration of ['0001_rooms.sql','0002_google_sessions.sql'])database.exec(await readFile(new URL(`../worker/migrations/${migration}`,import.meta.url),'utf8'));
  const binding={prepare(sql){const statement=database.prepare(sql);return {values:[],bind(...values){this.values=values;return this;},async first(){return statement.get(...this.values)||null;},async run(){const result=statement.run(...this.values);return {meta:{changes:result.changes}};}};}};
  const store=new D1Store(binding),session={account:{id:'google:123',provider:'google',name:'Alice'},expiresAt:Date.now()+60000};
  await store.sessionInsert('expired',{...session,expiresAt:1});
  await store.sessionInsert('session-hash',session);
  assert.deepEqual(await store.sessionRead('session-hash'),session);
  assert.equal(await store.sessionRead('expired'),null);
  await store.sessionDelete('session-hash');
  assert.equal(await store.sessionRead('session-hash'),null);
 }finally{database.close();}
});

test('local Google sessions survive process-store recreation and can be revoked',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wishwheel-auth-'));
 try{
  const session={account:{id:'google:123',provider:'google'},expiresAt:Date.now()+60000};
  const first=new LocalFileStore(directory);await first.sessionInsert('hash',session);
  const second=new LocalFileStore(directory);assert.deepEqual(await second.sessionRead('hash'),session);
  assert.equal(await second.byOwner('hash'),null);
  await second.sessionDelete('hash');assert.equal(await first.sessionRead('hash'),null);
 }finally{await rm(directory,{recursive:true,force:true});}
});
