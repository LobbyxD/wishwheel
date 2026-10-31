import type {Member} from './types';

export type PublicPlayer=Pick<Member,'id'|'name'|'status'|'spinStartedAt'|'spinEndsAt'>;
export type Activity={key:string;people:string[];phase:'picking'|'celebrating';remaining:number};
export const publicPlayers=(members:Member[]):PublicPlayer[]=>members.map(({id,name,status,spinStartedAt,spinEndsAt})=>({id,name,status,spinStartedAt,spinEndsAt}));

// Only public status/timing enters this function: no item ID, wheel angle or
// assignment is sent to spectators, including when they miss a polling tick.
export function nextActivity(previous:PublicPlayer[]|null,current:PublicPlayer[],me:string,serverNow:number):Activity|null{
 const changed=current.filter(person=>{
  if(person.id===me||person.status==='waiting')return false;
  const before=previous?.find(player=>player.id===person.id);
  if(!previous)return person.status==='picking';
  if(person.spinStartedAt!=null&&serverNow-person.spinStartedAt>20000)return false;
  return person.spinStartedAt!=null?before?.spinStartedAt!==person.spinStartedAt:before?.status==='waiting';
 });
 if(!changed.length)return null;
 const picking=changed.filter(person=>person.status==='picking');
 const actors=picking.length?picking:changed;
 return {key:actors.map(person=>`${person.id}:${person.spinStartedAt??person.status}`).join('|'),people:actors.map(person=>person.name),phase:picking.length?'picking':'celebrating',remaining:Math.max(0,...actors.map(person=>person.spinEndsAt!=null?person.spinEndsAt-serverNow:5000))};
}
