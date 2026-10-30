import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/http.mjs';
import {createRoom,hashToken,newToken} from '../server/engine.mjs';
const token=newToken();
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(b){this.body=b;return this;}};}
function request(extra={}){return {method:'POST',headers:{host:'wishwheel.test',origin:'https://wishwheel.test','content-type':'application/json',authorization:`Bearer ${token}`},body:{action:'state',code:'AB23CD'},...extra};}
const room=createRoom('Daniel',{},hashToken(token),'AB23CD');
function store(){return {calls:[],async rate(...args){this.calls.push(args);return true;},async read(){return {state:room,revision:1};}};}
test('production boundary returns no-store and own-state without secrets',async()=>{
 const db=store(),res=response();await createHandler(()=>db)(request(),res);
 assert.equal(res.statusCode,200);assert.match(res.headers['Cache-Control'],/no-store/);
 assert.equal(res.headers['Referrer-Policy'],'no-referrer');assert.equal(res.body.me.name,'Daniel');
 assert.ok(!JSON.stringify(res.body).includes(hashToken(token)));
 assert.ok(db.calls.some(call=>call[0]===`session:read:${hashToken(token)}`&&call[1]===90));
});
test('method, origin and content-type rejected before store access',async()=>{
 const handler=createHandler(()=>{throw new Error('must not touch store');});
 for(const [req,status] of [
  [request({method:'DELETE'}),405],
  [request({headers:{host:'wishwheel.test',origin:'https://evil.test','content-type':'application/json'}}),403],
  [request({headers:{host:'wishwheel.test','content-type':'text/plain'}}),415]
 ]){const res=response();await handler(req,res);assert.equal(res.statusCode,status);}
});
test('missing and malformed tokens cannot enumerate room state',async()=>{
 const db=store(),res=response();await createHandler(()=>db)(request({headers:{host:'wishwheel.test','content-type':'application/json'}}),res);
 assert.equal(res.statusCode,401);assert.equal(res.body.error.code,'SESSION_REQUIRED');
});
test('rate limit produces retry-after, no record read',async()=>{
 const db={rate:async()=>false,read:async()=>{throw new Error('must not read');}},res=response();
 await createHandler(()=>db)(request(),res);assert.equal(res.statusCode,429);assert.equal(res.headers['Retry-After'],'60');
});
test('internal exceptions never expose secret/query messages',async()=>{
 const res=response();await createHandler(()=>{throw new Error('SECRET_SERVICE_KEY SELECT state FROM private;');})(request(),res);
 assert.ok(!JSON.stringify(res.body).includes('SECRET'));assert.ok(!JSON.stringify(res.body).includes('SELECT'));
});
test('GET state uses same auth boundary and separate read rate classification',async()=>{
 const db=store(),res=response();await createHandler(()=>db)(request({method:'GET',query:{code:'AB23CD'},body:undefined}),res);
 assert.equal(res.statusCode,200);assert.ok(db.calls.some(call=>call[0].startsWith('session:read:')));
});

test('invitation preview is public without weakening the private state boundary',async()=>{
 const db=store(),res=response();
 await createHandler(()=>db)(request({headers:{host:'wishwheel.test','content-type':'application/json'},body:{action:'preview',code:room.code}}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.title,room.settings.title);
 const payload=JSON.stringify(res.body);assert.ok(!payload.includes(room.ownerId));assert.ok(!payload.includes('result'));assert.ok(!payload.includes('token'));
 const privateResponse=response();await createHandler(()=>db)(request({headers:{host:'wishwheel.test','content-type':'application/json'}}),privateResponse);
 assert.equal(privateResponse.statusCode,401);
});
