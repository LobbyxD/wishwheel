export const errorMessages:Record<string,string>={INVALID_NAME:'יש להזין שם באורך 1–32 תווים.',INVALID_SETTINGS:'הגדרות החדר אינן תקינות. בדקו את השם ומספר המשתתפים.',INVALID_ITEMS:'יש להוסיף 2–100 פריטים ייחודיים, עד 80 תווים לפריט.',DUPLICATE_ITEMS:'יש להסיר פריטים כפולים מהרשימה.',INVALID_IMAGE:'יש לבחור תמונת PNG, JPG או WebP קטנה מ־300 KB.',SESSION_REQUIRED:'יש להשתמש בקישור החזרה הפרטי שלך או להצטרף לחדר.',ROOM_STARTED:'החדר כבר התחיל.',ROOM_FULL:'החדר מלא.',NAME_TAKEN:'השם הזה כבר בחדר. השתמשו בקישור החזרה הפרטי או בשם אחר.',IMPOSSIBLE_DRAW:'אין אפשרות להגרלה הוגנת עם הרשימה הזו. יש להוסיף פריטים שונים.',NOT_ENOUGH_ITEMS:'צריך לפחות פריט ייחודי אחד לכל משתתף, או לאפשר בחירות חוזרות.',STALE_GENERATION:'המארח איפס את החדר. יש לרענן כדי לראות את הסיבוב הנוכחי.',OWNER_ONLY:'רק המארח יכול לבצע פעולה זו.',NEED_PLAYERS:'צריך להזמין לפחות אדם נוסף לפני שמתחילים.',NOT_STARTED:'יש להמתין עד שהמארח יתחיל.',NOT_YOUR_TURN:'יש להמתין לתור שלך.',RATE_LIMITED:'יותר מדי בקשות. כדאי להמתין דקה ולנסות שוב.',ROOM_NOT_FOUND:'החדר לא נמצא. כדאי לבדוק את הקוד.',NOT_FOUND:'החדר לא נמצא. כדאי לבדוק את הקוד.',SERVICE_UNAVAILABLE:'שירות החדרים אינו זמין כרגע. נסו שוב בקרוב.',INVALID_TOKEN:'קישור החזרה הפרטי אינו תקין.',INVALID_CODE:'יש להזין קוד חדר בן 6 תווים.',STORAGE_UNAVAILABLE:'שירות החדרים אינו זמין כרגע. נסו שוב בקרוב.'};
Object.assign(errorMessages,{
 PERSONAL_CODE_REQUIRED:'יש להזין את הקוד האישי הפרטי שקיבלת מהמארח.',
 INVALID_PERSONAL_CODE:'הקוד האישי אינו תקין או שהוחלף. יש לבקש קוד חדש מהמארח.',
 PERSONAL_IDENTITY_LOCKED:'הקוד האישי מזהה את המקום שלך. אי אפשר לבחור אדם אחר.',
 GOOGLE_REQUIRED:'יש להיכנס עם חשבון Google המקושר למקום הזה.',
 SESSION_REPLACED:'החיבור הפרטי הוחלף. יש להיכנס שוב עם הקוד האישי העדכני.',
 GOOGLE_SIGN_IN_FAILED:'לא ניתן לאמת את הכניסה עם Google. יש לנסות שוב.',
 AUTH_NOT_CONFIGURED:'הכניסה עם Google עדיין אינה מוגדרת. אפשר להמשיך כאורח.',
 INVALID_ROSTER:'יש להזין 2–50 שמות שונים ולכלול גם את המארח.',
 NOT_LISTED:'יש לבחור את השם שלך מהרשימה של המארח.',
 IDENTITY_LOCKED:'הזהות שלך נעולה עד לאיפוס החדר.',
 ROSTER_INCOMPLETE:'ממתינים לכל האנשים שברשימה שיבחרו את מקומם.',
 REMOVED:'המארח הסיר אותך מהחדר.',
 CANNOT_KICK_HOST:'אי אפשר להסיר את המארח.',
 INVALID_MEMBER:'יש לבחור משתתף להסרה.'
});
export function message(error:unknown,hebrew:boolean){const e=error as Error&{code?:string};return hebrew?(errorMessages[e.code||'']||'לא הצלחנו להשלים את הפעולה. כדאי לנסות שוב.'):(e.message||'Something went wrong.');}
