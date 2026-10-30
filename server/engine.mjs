import { randomBytes, randomInt, randomUUID, createHash } from 'node:crypto';

export class AppError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const fail = (code, message, status = 400) => { throw new AppError(code, message, status); };
export const normalize = (text) => String(text).normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const validToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
export function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const digits = '23456789'; const all = letters + digits;
  return shuffle([letters[randomInt(letters.length)], digits[randomInt(digits.length)], ...Array.from({length:4}, () => all[randomInt(all.length)])]).join('');
}
export function shuffle(values, random = randomInt) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = random(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function cleanName(value) {
  if (typeof value !== 'string') fail('INVALID_NAME', 'Enter a name between 1 and 32 characters.');
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!name || name.length > 32 || /[\p{Cc}\p{Cf}]/u.test(name)) fail('INVALID_NAME', 'Enter a name between 1 and 32 characters.');
  return name;
}
export function cleanSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_SETTINGS', 'Room settings are invalid.');
  const title = typeof value.title === 'string' ? value.title.trim() : 'Christmas wishes';
  if (!title || title.length > 60 || /[\p{Cc}\p{Cf}]/u.test(title)) fail('INVALID_SETTINGS', 'The room title must be 1–60 characters.');
  const participantMode = value.participantMode ?? 'open';
  if (!['open','roster'].includes(participantMode)) fail('INVALID_ROSTER','Choose an open room or a prelisted guest room.');
  let roster = [];
  if (participantMode === 'roster') {
    if (!Array.isArray(value.roster) || value.roster.length < 2 || value.roster.length > 50) fail('INVALID_ROSTER','List 2–50 people, including yourself.');
    roster = value.roster.map(cleanName);
    if (new Set(roster.map(normalize)).size !== roster.length) fail('INVALID_ROSTER','Each person in the guest list needs a unique name.');
  }
  const maxMembers = participantMode === 'roster' ? roster.length : Number(value.maxMembers ?? 12);
  if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 50) fail('INVALID_SETTINGS', 'Choose a room limit from 2 to 50.');
  const poolMode = value.poolMode ?? 'names';
  if (!['names', 'custom', 'mixed'].includes(poolMode)) fail('INVALID_SETTINGS', 'Choose names or a custom list.');
  let items = [];
  if (poolMode !== 'names') {
    if (!Array.isArray(value.items) || value.items.length < 2 || value.items.length > 100) fail('INVALID_ITEMS', 'Add between 2 and 100 unique items.');
    items = value.items.map(item => {
      if (typeof item !== 'string') fail('INVALID_ITEMS', 'Every item must be text.');
      const result = item.normalize('NFKC').trim().replace(/\s+/gu, ' ');
      if (!result || result.length > 80 || /[\p{Cc}\p{Cf}]/u.test(result)) fail('INVALID_ITEMS', 'Items must be 1–80 characters.');
      return result;
    });
    if (new Set(items.map(normalize)).size !== items.length) fail('DUPLICATE_ITEMS', 'Remove duplicate items from the list.');
  }
  const coverColor = value.coverColor ?? '#a82643';
  if (typeof coverColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(coverColor)) fail('INVALID_SETTINGS', 'Choose a valid cover color.');
  const coverType = value.coverType ?? 'color';
  if (!['color','image'].includes(coverType)) fail('INVALID_SETTINGS', 'Choose a color or image cover.');
  const coverImage = value.coverImage || '';
  if (typeof coverImage !== 'string' || coverImage.length > 410000 || (coverImage && !/^\/(?!\/)[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(coverImage) && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(coverImage))) fail('INVALID_IMAGE', 'Use a PNG, JPG or WebP image smaller than 300 KB.');
  for (const key of ['removePicked','turnBased','wheelHidden','musicEnabled']) if (value[key] !== undefined && typeof value[key] !== 'boolean') fail('INVALID_SETTINGS', 'Room switches must be true or false.');
  return {title,maxMembers,participantMode,roster,poolMode,items,excludeSelf:true,removePicked:value.removePicked ?? true,turnBased:value.turnBased ?? true,wheelHidden:value.wheelHidden ?? false,coverType,coverColor,coverImage,musicEnabled:value.musicEnabled ?? true};
}
export function createRoom(name, settings, tokenHash, code = newCode(), now = Date.now()) {
  const cleaned = cleanSettings(settings);
  name = rosterName(cleaned,name);
  const member = {id:randomUUID(),name,tokenHash,joinedAt:now};
  return {code,phase:'lobby',generation:1,settings:cleaned,ownerId:member.id,members:[member],items:[],assignments:{},turnOrder:[],revokedTokenHashes:[],createdAt:now};
}
function rosterName(settings,name) {
  name=cleanName(name);
  if(settings.participantMode!=='roster')return name;
  const listed=settings.roster.find(person=>normalize(person)===normalize(name));
  if(!listed)fail('NOT_LISTED','Choose your name from the host’s guest list.',403);
  return listed;
}
function requireNotRemoved(room,tokenHash) {
  if(room.revokedTokenHashes?.includes(tokenHash))fail('REMOVED','The host removed you from this room.',403);
}
export function getMember(room, tokenHash) { return room.members.find(member => member.tokenHash === tokenHash); }
export function requireMember(room, tokenHash) {
  requireNotRemoved(room,tokenHash);
  const member = getMember(room,tokenHash);
  if (!member) fail('SESSION_REQUIRED', 'Use your private recovery link or join this room.', 401);
  return member;
}
export function joinRoom(room, name, tokenHash, now = Date.now()) {
  requireNotRemoved(room,tokenHash);
  const existing = getMember(room,tokenHash); if (existing) return room;
  if (room.phase !== 'lobby') fail('ROOM_STARTED', 'This room has already started.',409);
  if (room.members.length >= room.settings.maxMembers) fail('ROOM_FULL', 'This room is full.',409);
  name = rosterName(room.settings,name);
  if (room.members.some(member => normalize(member.name) === normalize(name))) fail('NAME_TAKEN', 'That name is already in the room. Use your saved session or choose another name.',409);
  room.members.push({id:randomUUID(),name,tokenHash,joinedAt:now}); return room;
}
export function buildPool(room) {
  const names=room.settings.poolMode==='custom'?[]:room.members.map(member=>({id:member.id,label:member.name,memberId:member.id}));
  const labels=new Set(names.map(item=>normalize(item.label)));
  const custom=room.settings.poolMode==='names'?[]:room.settings.items.map((label,index)=>({id:`item-${index}`,label})).filter(item=>!labels.has(normalize(item.label)));
  return [...names,...custom];
}
export const eligible = (member,item) => member.id !== item.memberId && normalize(member.name) !== normalize(item.label);
// Randomized augmenting-path matching always finds a feasible complete assignment,
// unlike sequential rejection sampling, which can strand the last participant.
export function matchAssignments(members, items, removePicked, random = randomInt) {
  const order = shuffle(members,random); const assignments = {};
  if (!removePicked) {
    for (const member of order) {
      const choices = items.filter(item => eligible(member,item));
      if (!choices.length) fail('IMPOSSIBLE_DRAW','Every participant needs at least one eligible item. Add more items.',409);
      assignments[member.id] = {itemId:choices[random(choices.length)].id,pickedAt:null,pickingUntil:null};
    }
    return assignments;
  }
  if (items.length < members.length) fail('NOT_ENOUGH_ITEMS','Add at least one unique item per participant, or allow repeats.',409);
  const holder = new Map(); const choices = new Map(order.map(member => [member.id,shuffle(items.filter(item => eligible(member,item)),random)]));
  function augment(memberId, seen) {
    for (const item of choices.get(memberId)) {
      if (seen.has(item.id)) continue; seen.add(item.id);
      const other = holder.get(item.id);
      if (!other || augment(other,seen)) { holder.set(item.id,memberId); return true; }
    }
    return false;
  }
  for (const member of order) if (!augment(member.id,new Set())) fail('IMPOSSIBLE_DRAW','This list cannot give everyone a unique non-self result. Add different items.',409);
  for (const [itemId,memberId] of holder) assignments[memberId] = {itemId,pickedAt:null,pickingUntil:null};
  return assignments;
}
export function memberStatus(room, id, now = Date.now()) {
  const assignment = room.assignments[id];
  if (!assignment || assignment.pickedAt === null) return 'waiting';
  return assignment.pickingUntil > now ? 'picking' : 'picked';
}
export function currentTurn(room, now = Date.now()) {
  if (room.phase === 'lobby' || !room.settings.turnBased) return null;
  return room.turnOrder.find(id => memberStatus(room,id,now) !== 'picked') ?? null;
}
export function mutateRoom(room, action, tokenHash, generation, now = Date.now(), input = {}) {
  const member = requireMember(room,tokenHash);
  if (!Number.isInteger(generation) || generation !== room.generation) fail('STALE_GENERATION','The host reset this room. Refresh to see the current round.',409);
  if(action==='identify') {
    if(room.phase!=='lobby')fail('IDENTITY_LOCKED','Your identity is locked for this round.',409);
    const name=rosterName(room.settings,input.name);
    if(room.members.some(person=>person.id!==member.id&&normalize(person.name)===normalize(name)))fail('NAME_TAKEN','That place has already been claimed.',409);
    member.name=name;return room;
  }
  if(action==='kick') {
    if(member.id!==room.ownerId)fail('OWNER_ONLY','Only the host can remove people.',403);
    if(typeof input.memberId!=='string'||!input.memberId||input.memberId.length>80)fail('INVALID_MEMBER','Choose a guest to remove.');
    if(input.memberId===room.ownerId)fail('CANNOT_KICK_HOST','The host cannot remove themselves.');
    const removed=room.members.find(person=>person.id===input.memberId);
    if(!removed)return room; // Safe retry after an uncertain response.
    room.revokedTokenHashes=[...new Set([...(room.revokedTokenHashes||[]),removed.tokenHash])];
    room.members=room.members.filter(person=>person.id!==removed.id);
    room.generation++;room.phase='lobby';room.items=[];room.assignments={};room.turnOrder=[];
    return room;
  }
  if (action === 'start' || action === 'reset') {
    if (member.id !== room.ownerId) fail('OWNER_ONLY','Only the host can do that.',403);
    if (action === 'reset') {
      room.generation++; room.phase='lobby'; room.items=[]; room.assignments={}; room.turnOrder=[]; return room;
    }
    if (room.phase !== 'lobby') return room;
    if (room.members.length < 2) fail('NEED_PLAYERS','Invite at least one other person before starting.',409);
    if(room.settings.participantMode==='roster'&&room.settings.roster.some(name=>!room.members.some(person=>normalize(person.name)===normalize(name))))fail('ROSTER_INCOMPLETE','Wait until everyone on the guest list has claimed their place.',409);
    room.items=buildPool(room); room.assignments=matchAssignments(room.members,room.items,room.settings.removePicked);
    room.turnOrder=shuffle(room.members.map(person=>person.id)); room.phase='active'; return room;
  }
  if (action === 'spin') {
    if (room.phase === 'lobby') fail('NOT_STARTED','Wait for the host to start the room.',409);
    const assignment=room.assignments[member.id];
    if (assignment.pickedAt !== null) return room; // Replay is idempotent, never another draw.
    if (room.settings.turnBased && currentTurn(room,now)!==member.id) fail('NOT_YOUR_TURN','Wait for your turn.',409);
    assignment.pickedAt=now; assignment.pickingUntil=now+6000;
    return room;
  }
  fail('INVALID_ACTION','Unknown room action.');
}
export function serializeRoom(room, tokenHash, now = Date.now()) {
  const me=requireMember(room,tokenHash);
  const allDone=room.phase!=='lobby' && room.members.every(member=>memberStatus(room,member.id,now)==='picked');
  const result=room.assignments[me.id];
  return {
    room:{code:room.code,phase:allDone?'complete':room.phase,generation:room.generation,settings:{...room.settings,items:room.settings.wheelHidden && me.id!==room.ownerId ? [] : room.settings.items},ownerId:room.ownerId,members:room.members.map(member=>({id:member.id,name:member.name,status:memberStatus(room,member.id,now)})),turnMemberId:currentTurn(room,now),turnOrder:[...room.turnOrder]},
    me:{id:me.id,name:me.name,isOwner:me.id===room.ownerId,status:memberStatus(room,me.id,now),result:result?.pickedAt!=null?room.items.filter(item=>item.id===result.itemId).map(({id,label})=>({id,label}))[0]:null},
    wheelItems:(room.phase==='lobby'?buildPool(room):room.items).map(({id,label})=>({id,label:room.settings.wheelHidden?'?':label}))
  };
}

// Invitation details only: no sessions, results, assignments or member IDs.
export function previewRoom(room,now=Date.now()) {
  const roster=room.settings.participantMode==='roster'?room.settings.roster:[];
  return {code:room.code,title:room.settings.title,phase:room.phase==='lobby'?'lobby':room.members.every(person=>memberStatus(room,person.id,now)==='picked')?'complete':'active',participantMode:room.settings.participantMode||'open',memberCount:room.members.length,maxMembers:room.settings.maxMembers,
    people:room.phase==='lobby'?roster.map(name=>({name,claimed:room.members.some(person=>normalize(person.name)===normalize(name))})):[]};
}
