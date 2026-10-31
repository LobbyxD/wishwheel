import {createRoom,joinRoom,mutateRoom,serializeRoom,previewRoom,ensureInvitations,issueInvitationCodes,bindAccount,hashToken,newToken,validToken,fail,cleanSettings,cleanName} from './engine.mjs';

// account is supplied only by the server's verified identity,
// never by room request JSON, a display name, or a client-side user ID.
export async function roomService(store,input,token,now=Date.now(),account=null){
 const action=input.action||'state';
 if(!['create','join','state','start','spin','reset','preview','identify','kick','issue-invites','regenerate-invite'].includes(action))fail('INVALID_ACTION','Unknown room action.');
 let code=typeof input.code==='string'?input.code.trim().toUpperCase():'';
 if(action!=='create'&&!/^[A-Z2-9]{6}$/.test(code))fail('INVALID_CODE','Enter the six-character room code.');
 if(action==='preview'){
  const record=await store.read(code);if(!record)fail('ROOM_NOT_FOUND','No room found with that code.',404);
  return previewRoom(record.state,now,account);
 }
 if(token&&!validToken(token))fail('SESSION_REQUIRED','Use your saved room session or private recovery link.',401);
 token=token||(['create','join'].includes(action)?newToken():null);
 if(!validToken(token)&&!account)fail('SESSION_REQUIRED','Use your saved room session or private recovery link.',401);
 const tokenHash=validToken(token)?hashToken(token):'';
 const view=(state,revision)=>{const result=serializeRoom(state,tokenHash,now,account);result.room.version=revision;return result;};
 if(action==='create'){
  cleanName(input.name);cleanSettings(input.settings);
  const existing=await store.byOwner(tokenHash);
  if(existing){const result=view(existing.state,existing.revision);return {...result,token,me:{...result.me,token}};}
  for(let attempt=0;attempt<6;attempt++){
   const state=createRoom(input.name,input.settings,tokenHash,undefined,now,account);
   const inviteCodes=state.settings.participantMode==='roster'?issueInvitationCodes(state,tokenHash,account,null,now):[];
   try{
    await store.insert(state,tokenHash);const result=view(state,1);
    return {...result,token,me:{...result.me,token},...(inviteCodes.length?{inviteCodes}:{})};
   }catch(error){
    if(error.code!=='CONFLICT')throw error;
    const recovered=await store.byOwner(tokenHash);
    if(recovered){const result=view(recovered.state,recovered.revision);return {...result,token,me:{...result.me,token}};}
   }
  }fail('BUSY','Please try creating the room again.',503);
 }
 for(let attempt=0;attempt<12;attempt++){
  const record=await store.read(code);if(!record)fail('ROOM_NOT_FOUND','No room found with that code.',404);
  const state=structuredClone(record.state);
  const migrated=ensureInvitations(state),linked=bindAccount(state,tokenHash,account);
  if(action==='state'&&!migrated&&!linked)return view(state,record.revision);
  let inviteCodes=[];
  if(action==='join')joinRoom(state,input.name,tokenHash,now,input.inviteCode,account);
  else if(action==='issue-invites'||action==='regenerate-invite'){
   if(action==='regenerate-invite'&&(typeof input.slotId!=='string'||!input.slotId))fail('INVALID_MEMBER','Choose a listed person.');
   inviteCodes=issueInvitationCodes(state,tokenHash,account,action==='regenerate-invite'?input.slotId:null,now);
  }else if(action!=='state')mutateRoom(state,action,tokenHash,input.generation,now,input,account);
  if(await store.cas(code,record.revision,state)){
   const result=view(state,record.revision+1);
   return {...result,...(action==='join'?{token,me:{...result.me,token}}:{}),...(inviteCodes.length?{inviteCodes}:{})};
  }
  await new Promise(resolve=>setTimeout(resolve,Math.min(attempt*7,50)));
 }
 fail('BUSY','The room is busy. Please retry.',409);
}
