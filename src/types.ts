export type Settings={title:string;maxMembers:number;participantMode:'open'|'roster';roster:string[];poolMode:'names'|'custom'|'mixed';items:string[];excludeSelf:boolean;removePicked:boolean;turnBased:boolean;wheelHidden:boolean;coverType:'color'|'image';coverColor:string;coverImage:string;musicEnabled:boolean};
export type Item={id:string;label:string};
export type Member={id:string;name:string;status:'waiting'|'picking'|'picked';accountLinked?:boolean;spinStartedAt?:number|null;spinEndsAt?:number|null};
export type Invitation={id:string;name:string;hasCode:boolean;accountLinked:boolean;claimed:boolean};
export type IssuedCode={id:string;name:string;code:string;accountLinked:boolean};
export type State={room:{code:string;serverNow?:number;phase:'lobby'|'active'|'complete';generation:number;settings:Settings;members:Member[];turnMemberId:string|null;turnOrder:string[];ownerId:string};me:Member&{isOwner:boolean;result:Item|null;token?:string};wheelItems:Item[];invitations?:Invitation[];inviteCodes?:IssuedCode[]};
export type RoomPreview={code:string;title:string;phase:'lobby'|'active'|'complete';participantMode:'open'|'roster';people:{name:string;claimed:boolean}[];memberCount:number;maxMembers:number;requiresPersonalCode?:boolean;canResume?:boolean};
