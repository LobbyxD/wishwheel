import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Store} from '../server/store.mjs';
test('missing D1 binding fails closed; backend errors do not leak details',async()=>{
 assert.throws(()=>new D1Store(),error=>error.code==='NOT_CONFIGURED'&&error.status===503);
 const db={prepare(){throw new Error('private SQL internal details');}};
 await assert.rejects(new D1Store(db).read('ABC234'),error=>error.code==='SERVICE_UNAVAILABLE'&&!error.message.includes('SQL'));
});
