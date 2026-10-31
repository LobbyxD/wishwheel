import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('dev startup handles a busy API port, proxies requests, and releases its ports', {timeout:30000}, async t=>{
 const blocker=net.createServer();
 try {
  blocker.listen(3001,'127.0.0.1');
  await once(blocker,'listening');
  t.after(()=>new Promise(resolve=>blocker.close(resolve)));
 }catch(error){
  // A running development instance also provides the occupied-port condition.
  if(error.code!=='EADDRINUSE')throw error;
 }
 // Vite treats --port 0 as its default port. Reserve a real ephemeral port so
 // this check can run while the developer's regular UI is already running.
 const reservation=net.createServer();
 reservation.listen(0,'127.0.0.1');
 await once(reservation,'listening');
 const uiTestPort=reservation.address().port;
 await new Promise(resolve=>reservation.close(resolve));
 const child=spawn(process.execPath,['server/devstart.mjs','--port',String(uiTestPort),'--strictPort'],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),
  env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0',WISHWHEEL_VOLATILE:'1'},
  stdio:['ignore','pipe','pipe','ipc']
 });
 const exited=once(child,'exit');
 t.after(async()=>{if(child.connected)child.disconnect();await exited;});
 let output='';
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`Dev server did not become ready:\n${output}`)),20000);
  const capture=chunk=>{
   output+=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');
   const api=output.match(/LOCAL API at http:\/\/127\.0\.0\.1:(\d+)/);
   const ui=output.match(/Local:\s+http:\/\/127\.0\.0\.1:(\d+)/);
   if(api&&ui){clearTimeout(timer);resolve({apiPort:Number(api[1]),uiPort:Number(ui[1])});}
  };
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error(`Dev server exited early:\n${output}`));});
 });
 const {apiPort,uiPort}=await ready;
 assert.notEqual(apiPort,3001);
 const base=`http://127.0.0.1:${uiPort}`;
 assert.equal((await fetch(base)).status,200);
 const auth=await fetch(`${base}/api/auth/session`,{headers:{Origin:base}});
 assert.equal(auth.status,200);
 const authState=await auth.json();assert.equal(authState.user,null);assert.match(authState.nonce,/^[A-Za-z0-9_-]{43}$/);
 const nonceCookie=auth.headers.getSetCookie()[0];assert.match(nonceCookie,/HttpOnly/);
 const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:nonceCookie.split(';')[0]},body:'{}'});
 assert.equal(logout.status,200);assert.equal(logout.headers.getSetCookie().length,2);
 const crossOrigin=await fetch(`${base}/api/auth/google`,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(crossOrigin.status,403);
 const response=await fetch(`${base}/api/room`,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'create',name:'Startup Test',settings:{title:'Port fallback test'}})
 });
 assert.equal(response.status,200);
 assert.equal((await response.json()).room.settings.title,'Port fallback test');
 child.disconnect();
 const [code]=await exited;
 assert.equal(code,0,output);
 for(const port of [apiPort,uiPort]){
  const probe=net.createServer();
  probe.listen(port,'127.0.0.1');
  await once(probe,'listening');
  await new Promise(resolve=>probe.close(resolve));
 }
});
