import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const filename of ['.env.local','.dev.vars']){const file=path.join(root,filename);if(existsSync(file))process.loadEnvFile(file);}
const viteEntry=path.join(root,'node_modules/vite/bin/vite.js');
if(!existsSync(viteEntry)){
 console.error('Wishwheel dependencies are missing. Run npm ci first (npm.cmd ci in Windows PowerShell), then run npm run dev again.');
 process.exit(1);
}
console.log('\nWishwheel local development: rooms are saved on this computer, not the production D1 database.\n');
const children=[];
let closing=false;
function close(code=0){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
function watch(child){
 children.push(child);
 child.on('error',error=>{console.error(error.message);close(1);});
 child.on('exit',(code,signal)=>close(code??(signal?1:0)));
 return child;
}
process.on('SIGINT',()=>close());process.on('SIGTERM',()=>close());
process.on('disconnect',()=>close());
const api=watch(spawn(process.execPath,['server/dev.mjs'],{cwd:root,env:{...process.env,WISHWHEEL_TEST_MODE:'1'},stdio:['inherit','inherit','inherit','ipc']}));
api.once('message',message=>{
 if(closing||message?.type!=='ready')return;
 watch(spawn(process.execPath,[viteEntry,'--host','127.0.0.1',...process.argv.slice(2)],{cwd:root,env:{...process.env,WISHWHEEL_TEST_MODE:'1',WISHWHEEL_API_PORT:String(message.port)},stdio:'inherit'}));
});
