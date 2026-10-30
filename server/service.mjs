import { createRoom, joinRoom, mutateRoom, serializeRoom, previewRoom, hashToken, newToken, validToken, fail, cleanSettings, cleanName } from './engine.mjs';

export async function roomService(store, input, token, now=Date.now()) {
  const action=input.action||'state';
  if (!['create','join','state','start','spin','reset','preview','identify','kick'].includes(action)) fail('INVALID_ACTION','Unknown room action.');
  if(action==='preview') {
    const code=typeof input.code==='string'?input.code.trim().toUpperCase():'';
    if(!/^[A-Z2-9]{6}$/.test(code))fail('INVALID_CODE','Enter the six-character room code.');
    const record=await store.read(code);
    if(!record)fail('ROOM_NOT_FOUND','No room found with that code.',404);
    return previewRoom(record.state,now);
  }
  const issuedToken = !token && (action==='create'||action==='join') ? newToken() : null;
  token = token || issuedToken;
  if (!validToken(token)) fail('SESSION_REQUIRED','Use your saved room session or private recovery link.',401);
  const tokenHash=hashToken(token);
  let code=typeof input.code==='string'?input.code.trim().toUpperCase():'';
  if(action!=='create' && !/^[A-Z2-9]{6}$/.test(code)) fail('INVALID_CODE','Enter the six-character room code.');
  if(action==='create') {
    cleanName(input.name); cleanSettings(input.settings);
    const existing=await store.byOwner(tokenHash);
    if(existing) return {...serializeRoom(existing.state,tokenHash,now),token,me:{...serializeRoom(existing.state,tokenHash,now).me,token}};
    for(let attempt=0;attempt<6;attempt++) {
      const state=createRoom(input.name,input.settings,tokenHash,undefined,now);
      try {
        await store.insert(state,tokenHash);
        return {...serializeRoom(state,tokenHash,now),token,me:{...serializeRoom(state,tokenHash,now).me,token}};
      } catch(error) {
        if(error.code!=='CONFLICT') throw error;
        const recovered=await store.byOwner(tokenHash);
        if(recovered) return {...serializeRoom(recovered.state,tokenHash,now),token,me:{...serializeRoom(recovered.state,tokenHash,now).me,token}};
      }
    }
    fail('BUSY','Please try creating the room again.',503);
  }
  for(let attempt=0;attempt<12;attempt++) {
    const record=await store.read(code);
    if(!record) fail('ROOM_NOT_FOUND','No room found with that code.',404);
    if(action==='state') return serializeRoom(record.state,tokenHash,now);
    const state=structuredClone(record.state);
    if(action==='join') joinRoom(state,input.name,tokenHash,now);
    else mutateRoom(state,action,tokenHash,input.generation,now,input);
    if(await store.cas(code,record.revision,state)) {
      const result=serializeRoom(state,tokenHash,now);
      return action==='join'?{...result,token,me:{...result.me,token}}:result;
    }
    // Retry from fresh state. Revalidation after every conflict is essential:
    // capacity, round generation, and whose turn may have changed.
    await new Promise(resolve=>setTimeout(resolve,Math.min(attempt*7,50)));
  }
  fail('BUSY','The room is busy. Please retry.',409);
}
