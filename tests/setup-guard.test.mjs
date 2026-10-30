import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/room.js';
test('unconfigured same-origin API fails closed with structured uncached503',()=>{
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(body){this.body=body;return this;}};
 const req=new Proxy({}, {get(){throw new Error('setup guard must not inspect participant data');}});
 handler(req,res);
 assert.equal(res.statusCode,503);assert.equal(res.body.error.code,'NOT_CONFIGURED');
 assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal(res.headers['Retry-After'],'60');
 assert.match(res.body.error.message,/setup is in progress/i);
});
