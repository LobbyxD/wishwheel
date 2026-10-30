import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseStore} from '../server/store.mjs';
test('modern Supabase secret key is apikey only, legacy key has bearer',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[]};};
 try{
  await new SupabaseStore('https://example.supabase.co','sb_secret_test-not-a-real-key').read('ABC234');
  assert.equal(calls[0].options.headers.apikey,'sb_secret_test-not-a-real-key');
  assert.equal(calls[0].options.headers.Authorization,undefined);
  await new SupabaseStore('https://example.supabase.co','legacy-test-not-a-real-key').read('ABC234');
  assert.equal(calls[1].options.headers.Authorization,'Bearer legacy-test-not-a-real-key');
 }finally{globalThis.fetch=original;}
});
