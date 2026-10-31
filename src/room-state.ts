import type {Member,State} from './types';
export type RoomEvent={type:'room-changed';code:string;generation:number;version:number;phase:State['room']['phase'];serverNow:number;kind:string;member?:Member};

export function reconcileState(current:State|null,incoming:State):State|null{
 if(!current||current.room.code!==incoming.room.code||incoming.room.generation>current.room.generation)return incoming;
 if(incoming.room.generation<current.room.generation)return null;
 if((incoming.room.version??0)<(current.room.version??0)){
  // A private spin response can arrive after a newer public notification.
  // Keep its private result while never rolling back public membership/turns.
  if(incoming.me.id===current.me.id)return {...current,me:{...current.me,result:incoming.me.result??current.me.result}};
  return null;
 }
 return incoming;
}

export function applyRoomEvent(state:State,event:RoomEvent):State|null{
 if(event?.type!=='room-changed'||event.code!==state.room.code||!Number.isSafeInteger(event.version)||event.version<1||!Number.isSafeInteger(event.generation)||event.generation<state.room.generation||!['lobby','active','complete'].includes(event.phase))return null;
 const stale=event.version<=(state.room.version??0),before=state.room.members.find(member=>member.id===event.member?.id);
 // Two independent spins/joins can be committed in order but delivered out of
 // order. Apply each new actor once while retaining the highest room revision.
 if(stale&&!(event.generation===state.room.generation&&event.member&&(event.kind==='join'&&!before||event.kind==='spin'&&typeof event.member.spinStartedAt==='number'&&(before?.spinStartedAt??-1)<event.member.spinStartedAt)))return null;
 const reset=event.generation>state.room.generation;
 let members=reset?state.room.members.map(member=>({...member,status:'waiting' as const,spinStartedAt:null,spinEndsAt:null})):state.room.members;
 if(event.member){
  const member=event.member;
  if(typeof member.id!=='string'||typeof member.name!=='string'||member.name.length>32||!['waiting','picking','picked'].includes(member.status))return null;
  // Explicit projection: notification JSON can never populate a secret result.
  const safe:Member={id:member.id,name:member.name,status:member.status,spinStartedAt:typeof member.spinStartedAt==='number'?member.spinStartedAt:null,spinEndsAt:typeof member.spinEndsAt==='number'?member.spinEndsAt:null};
  if(safe.status==='picking'&&safe.spinEndsAt!==null&&safe.spinEndsAt!==undefined&&safe.spinEndsAt<=(state.room.serverNow??0))safe.status='picked';
  members=members.some(person=>person.id===safe.id)?members.map(person=>person.id===safe.id?safe:person):event.kind==='join'?[...members,safe]:members;
 }
 const me=members.find(member=>member.id===state.me.id);
 return {...state,room:{...state.room,members,version:Math.max(event.version,state.room.version??0),generation:event.generation,phase:stale?state.room.phase:event.phase,serverNow:Math.max(event.serverNow,state.room.serverNow??0)},me:{...state.me,...(me?{status:me.status}:{}),...(reset?{result:null}:{})}};
}

export function settleRoomSpins(state:State,serverNow:number):State{
 if(state.room.phase==='lobby')return state;
 let changed=false;
 const members=state.room.members.map(member=>{if(member.status==='picking'&&typeof member.spinEndsAt==='number'&&member.spinEndsAt<=serverNow){changed=true;return {...member,status:'picked' as const};}return member;});
 if(!changed)return state;
 const byId=new Map(members.map(member=>[member.id,member])),complete=members.every(member=>member.status==='picked');
 return {...state,room:{...state.room,members,serverNow,phase:complete?'complete':'active',turnMemberId:state.room.settings.turnBased?state.room.turnOrder.find(id=>byId.get(id)?.status!=='picked')??null:null},me:{...state.me,status:byId.get(state.me.id)?.status??state.me.status}};
}
