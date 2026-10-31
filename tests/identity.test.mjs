import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {roomService} from '../server/service.mjs';
import {newToken,hashToken,createRoom,joinRoom,issueInvitationCodes,serializeRoom} from '../server/engine.mjs';
import {verifyGoogleCredential,readAccount} from '../server/google-auth.mjs';
import {createWorker} from '../worker/index.mjs';

class Store{
 records=new Map();sessions=new Map();calls=[];
 async read(code){return structuredClone(this.records.get(code)||null);}
 async byOwner(hash){return structuredClone([...this.records.values()].find(record=>record.ownerHash===hash)||null);}
 async insert(state,ownerHash){this.records.set(state.code,{state:structuredClone(state),ownerHash,revision:1});}
 async cas(code,revision,state){const record=this.records.get(code);if(record.revision!==revision)return false;this.records.set(code,{...record,revision:revision+1,state:structuredClone(state)});return true;}
 async rate(...args){this.calls.push(args);return true;}
 async sessionRead(hash){return structuredClone(this.sessions.get(hash)||null);}
 async sessionInsert(hash,session){this.sessions.set(hash,structuredClone(session));}
 async sessionDelete(hash){this.sessions.delete(hash);}
}
const owner=newToken(),bob=newToken(),carol=newToken();
const googleA={id:'google:1001',provider:'google'},googleB={id:'google:1002',provider:'google'};
async function setup(){const store=new Store(),created=await roomService(store,{action:'create',name:'Alice',settings:{participantMode:'roster',roster:['Alice','Bob','Carol'],turnBased:false}},owner);return {store,created,code:created.room.code,codes:Object.fromEntries(created.inviteCodes.map(person=>[person.name,person]))};}

test('each listed person gets a distinct six-character private code, stored only as a salted hash',async()=>{
 const {store,created,codes}=await setup();
 assert.equal(new Set(created.inviteCodes.map(person=>person.code)).size,3);
 for(const person of created.inviteCodes){assert.match(person.code,/^[A-Z2-9]{6}$/);assert.match(person.code,/[A-Z]/);assert.match(person.code,/[2-9]/);}
 const persisted=JSON.stringify((await store.read(created.room.code)).state);
 for(const person of created.inviteCodes)assert.ok(!persisted.includes(`"${person.code}"`));
 const preview=await roomService(store,{action:'preview',code:created.room.code},null);assert.deepEqual(preview.people,[]);assert.equal(preview.requiresPersonalCode,true);
 const state=await roomService(store,{action:'state',code:created.room.code},owner);assert.ok(!state.inviteCodes);
 assert.ok(!JSON.stringify(state).includes('codeHash'));assert.ok(!JSON.stringify(state).includes('inviteSalt'));
 await assert.rejects(roomService(store,{action:'join',code:created.room.code,name:'Bob'},bob),{code:'PERSONAL_CODE_REQUIRED'});
 const joined=await roomService(store,{action:'join',code:created.room.code,name:'Carol',inviteCode:codes.Bob.code},bob);
 assert.equal(joined.me.name,'Bob');assert.ok(!joined.invitations);assert.ok(!joined.inviteCodes);
 await assert.rejects(roomService(store,{action:'identify',code:created.room.code,generation:1,name:'Carol'},bob),{code:'PERSONAL_IDENTITY_LOCKED'});
 await assert.rejects(roomService(store,{action:'regenerate-invite',code:created.room.code,slotId:codes.Carol.id},bob),{code:'OWNER_ONLY'});
});

test('regenerated guest codes revoke old credentials while retaining the same participant and result',async()=>{
 const {store,code,codes}=await setup();
 const joined=await roomService(store,{action:'join',code,inviteCode:codes.Bob.code},bob);
 await roomService(store,{action:'join',code,inviteCode:codes.Carol.code},carol);
 await roomService(store,{action:'start',code,generation:1},owner);
 const picked=await roomService(store,{action:'spin',code,generation:1},bob);
 const replaced=await roomService(store,{action:'regenerate-invite',code,slotId:codes.Bob.id},owner);
 const fresh=replaced.inviteCodes[0].code;assert.notEqual(fresh,codes.Bob.code);
 await assert.rejects(roomService(store,{action:'join',code,inviteCode:codes.Bob.code},newToken()),{code:'INVALID_PERSONAL_CODE'});
 await assert.rejects(roomService(store,{action:'state',code},bob),{code:'SESSION_REPLACED'});
 const recovered=await roomService(store,{action:'join',code,inviteCode:fresh},newToken());
 assert.equal(recovered.me.id,joined.me.id);assert.deepEqual(recovered.me.result,picked.me.result);
});

test('a Google-linked place rejects copied codes and recovery tokens, including after rotation',async()=>{
 const {store,code,codes}=await setup();
 const linked=await roomService(store,{action:'join',code,inviteCode:codes.Bob.code},bob,100,googleA);
 assert.equal(linked.me.accountLinked,true);
 await assert.rejects(roomService(store,{action:'state',code},bob),{code:'GOOGLE_REQUIRED'});
 await assert.rejects(roomService(store,{action:'join',code,inviteCode:codes.Bob.code},newToken()),{code:'GOOGLE_REQUIRED'});
 await assert.rejects(roomService(store,{action:'join',code,inviteCode:codes.Bob.code},newToken(),101,googleB),{code:'GOOGLE_REQUIRED'});
 const resumed=await roomService(store,{action:'state',code},null,102,googleA);assert.equal(resumed.me.id,linked.me.id);
 const preview=await roomService(store,{action:'preview',code},null,102,googleA);assert.equal(preview.canResume,true);
 const other=await roomService(store,{action:'join',code,inviteCode:codes.Carol.code},newToken(),103,googleA);assert.equal(other.me.name,'Bob');
 const replaced=await roomService(store,{action:'regenerate-invite',code,slotId:codes.Bob.id},owner);
 await assert.rejects(roomService(store,{action:'join',code,inviteCode:replaced.inviteCodes[0].code},newToken(),104,googleB),{code:'GOOGLE_REQUIRED'});
 assert.equal((await roomService(store,{action:'state',code},null,105,googleA)).me.id,linked.me.id);
 await roomService(store,{action:'kick',code,generation:1,memberId:linked.me.id},owner);
 const reissued=await roomService(store,{action:'issue-invites',code},owner);
 await assert.rejects(roomService(store,{action:'join',code,inviteCode:reissued.inviteCodes[0].code},newToken()),{code:'GOOGLE_REQUIRED'});
 const returned=await roomService(store,{action:'join',code,inviteCode:reissued.inviteCodes[0].code},newToken(),106,googleA);assert.equal(returned.me.name,'Bob');
});

test('signing in upgrades an existing guest place and old rooms migrate without losing sessions',async()=>{
 const {store,code,codes}=await setup();await roomService(store,{action:'join',code,inviteCode:codes.Bob.code},bob);
 const upgraded=await roomService(store,{action:'state',code},bob,100,googleA);assert.equal(upgraded.me.accountLinked,true);
 await assert.rejects(roomService(store,{action:'state',code},bob),{code:'GOOGLE_REQUIRED'});
 const room=createRoom('Alice',{participantMode:'roster',roster:['Alice','Bob']},hashToken(owner));
 const invites=issueInvitationCodes(room,hashToken(owner));joinRoom(room,'Bob',hashToken(bob),100,invites.find(person=>person.name==='Bob').code);
 delete room.invitationSlots;delete room.inviteSalt;for(const member of room.members)delete member.slotId;
 const legacy=new Store();await legacy.insert(room,hashToken(owner));
 const existing=await roomService(legacy,{action:'state',code:room.code},bob);assert.equal(existing.me.name,'Bob');
 const generated=await roomService(legacy,{action:'issue-invites',code:room.code},owner);assert.equal(generated.inviteCodes.length,2);
 assert.equal((await roomService(legacy,{action:'state',code:room.code},bob)).me.name,'Bob');
});

const origin='https://wishwheel.example',clientId='test-client.apps.googleusercontent.com';
const pair=await generateKeyPair('RS256'),jwk=await exportJWK(pair.publicKey);
const keys=createLocalJWKSet({keys:[{...jwk,kid:'test',alg:'RS256'}]});
async function credential(nonce,overrides={}){
 return new SignJWT({nonce,name:'Google User',email:'user@example.test',email_verified:true,...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience(clientId).setSubject('1001').setIssuedAt().setExpirationTime('1h').sign(pair.privateKey);
}

test('Google credentials require a real signature, correct audience, issuer, expiry and nonce',async()=>{
 const nonce=newToken(),token=await credential(nonce);
 assert.equal((await verifyGoogleCredential(token,clientId,nonce,keys)).id,'google:1001');
 await assert.rejects(verifyGoogleCredential(token,'wrong-client',nonce,keys),{code:'GOOGLE_SIGN_IN_FAILED'});
 await assert.rejects(verifyGoogleCredential(token,clientId,newToken(),keys),{code:'GOOGLE_SIGN_IN_FAILED'});
 await assert.rejects(verifyGoogleCredential(token,clientId,undefined,keys),{code:'GOOGLE_SIGN_IN_FAILED'});
 await assert.rejects(verifyGoogleCredential(token,'',nonce,keys),{code:'AUTH_NOT_CONFIGURED'});
 const wrongIssuer=await new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://evil.example').setAudience(clientId).setSubject('1001').setIssuedAt().setExpirationTime('1h').sign(pair.privateKey);
 await assert.rejects(verifyGoogleCredential(wrongIssuer,clientId,nonce,keys),{code:'GOOGLE_SIGN_IN_FAILED'});
 const parts=token.split('.');parts[2]=parts[2].replace(/^./,parts[2][0]==='A'?'B':'A');
 await assert.rejects(verifyGoogleCredential(parts.join('.'),clientId,nonce,keys),{code:'GOOGLE_SIGN_IN_FAILED'});
 const expired=await new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience(clientId).setSubject('1001').setIssuedAt(1).setExpirationTime(2).sign(pair.privateKey);
 await assert.rejects(verifyGoogleCredential(expired,clientId,nonce,keys),{code:'GOOGLE_SIGN_IN_FAILED'});
});

function req(path,body,cookie='',extra={}){return new Request(`${origin}${path}`,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});}

test('Worker Google login creates a protected server session, auto-resumes the linked person and logs out',async()=>{
 const {store,code,codes}=await setup(),worker=createWorker(()=>store,(token,id,nonce)=>verifyGoogleCredential(token,id,nonce,keys)),env={ALLOWED_ORIGINS:origin,GOOGLE_CLIENT_ID:clientId};
 const start=await worker.fetch(req('/api/auth/session'),env),session=await start.json();
 const nonceCookie=start.headers.getSetCookie()[0];assert.match(nonceCookie,/__Host-ww_google_nonce=/);assert.match(nonceCookie,/HttpOnly/);assert.match(nonceCookie,/Secure/);
 const logged=await worker.fetch(req('/api/auth/google',{credential:await credential(session.nonce)},nonceCookie.split(';')[0]),env);
 assert.equal(logged.status,200);const login=await logged.json();assert.equal(login.user.id,'google:1001');
 const authCookie=logged.headers.getSetCookie().find(value=>value.startsWith('__Host-ww_google_session='));
 assert.match(authCookie,/SameSite=Lax/);assert.match(authCookie,/HttpOnly/);assert.match(authCookie,/Secure/);
 const cookie=authCookie.split(';')[0],rawToken=cookie.split('=')[1];assert.ok(store.sessions.has(hashToken(rawToken)));assert.ok(!store.sessions.has(rawToken));
 assert.equal(await readAccount(req('/api/auth/session',null,cookie),store,Date.now()+31*24*60*60*1000),null);
 const joined=await worker.fetch(req('/api/room',{action:'join',code,inviteCode:codes.Bob.code},cookie,{Authorization:`Bearer ${bob}`}),env);
 assert.equal(joined.status,200);assert.equal((await joined.json()).me.accountLinked,true);
 const automatic=await worker.fetch(req('/api/room',{action:'state',code},cookie),env);assert.equal(automatic.status,200);assert.equal((await automatic.json()).me.name,'Bob');
 const forged=await worker.fetch(req('/api/room',{action:'join',code,inviteCode:codes.Bob.code,account:{id:login.user.id}},'',{Authorization:`Bearer ${newToken()}`}),env);assert.equal(forged.status,403);
 const logout=await worker.fetch(req('/api/auth/logout',{},cookie),env);assert.equal(logout.status,200);assert.equal(store.sessions.size,0);
 const stale=await worker.fetch(req('/api/room',{action:'state',code},cookie,{Authorization:`Bearer ${bob}`}),env);assert.equal(stale.status,403);
 const csrf=await worker.fetch(req('/api/auth/google',{credential:'fake'},cookie,{Origin:'https://evil.example'}),env);assert.equal(csrf.status,403);
});

test('private-code guesses are limited before room data is read',async()=>{
 let read=false;const store={async rate(bucket,limit,seconds){if(bucket.startsWith('invite:')){assert.equal(limit,60);assert.equal(seconds,600);return false;}return true;},async read(){read=true;throw new Error();}};
 const response=await createWorker(()=>store).fetch(req('/api/room',{action:'join',code:'AB23CD',inviteCode:'ZZ2ABC'},'',{Authorization:`Bearer ${newToken()}`}),{ALLOWED_ORIGINS:origin});
 assert.equal(response.status,429);assert.equal(read,false);
});

test('live tickets enforce Google locks and never trust a JSON account identity',async()=>{
 const {store,code,codes}=await setup();await roomService(store,{action:'join',code,inviteCode:codes.Bob.code},bob,100,googleA);
 let issued=0;const env={ALLOWED_ORIGINS:origin,ROOM_LIVE:{idFromName:value=>value,get(){return {async fetch(){issued++;return Response.json({ticket:newToken()});}};}}};
 const worker=createWorker(()=>store);
 const stolen=await worker.fetch(req('/api/live-ticket',{code,account:googleA},'',{Authorization:`Bearer ${bob}`}),env);
 assert.equal(stolen.status,403);assert.equal(issued,0);
 const session=newToken();await store.sessionInsert(hashToken(session),{account:googleA,expiresAt:Date.now()+60000});
 const allowed=await worker.fetch(req('/api/live-ticket',{code},`__Host-ww_google_session=${session}`),env);
 assert.equal(allowed.status,200);assert.equal(issued,1);assert.ok((await allowed.json()).ticket);
});
