// Instrumental chorus, arranged in C for this app. No recorded audio or lyrics.
// Composition: James Lord Pierpont. Historical score reference:
// https://www.loc.gov/item/2023812429/
type Note = readonly [midi: number, beats: number];
export const TEMPO = 110;
export const BEAT_SECONDS = 60 / TEMPO;
export const CHORUS: readonly (readonly Note[])[] = [
 [[76,1],[76,1],[76,2]],
 [[76,1],[76,1],[76,2]],
 [[76,1],[79,1],[72,1],[74,1]],
 [[76,4]],
 [[77,1],[77,1],[77,1],[77,1]],
 [[77,1],[76,1],[76,1],[76,.5],[76,.5]],
 [[76,1],[74,1],[74,1],[76,1]],
 [[74,2],[79,2]],
 [[76,1],[76,1],[76,2]],
 [[76,1],[76,1],[76,2]],
 [[76,1],[79,1],[72,1],[74,1]],
 [[76,4]],
 [[77,1],[77,1],[77,1],[77,1]],
 [[77,1],[76,1],[76,2]],
 [[79,1],[79,1],[77,1],[74,1]],
 [[72,4]]
];
const C = [48,52,55], F = [48,53,57], D = [50,54,57], G = [47,50,55];
const chords = [C,C,C,C,F,C,D,G,C,C,C,C,F,C,G,C];
export const LOOP_BEATS = CHORUS.length * 4;
export type MusicEvent = {beat:number;kind:'melody';midi:number;beats:number} | {beat:number;kind:'chord';notes:number[]} | {beat:number;kind:'sleigh';accent:boolean};
export const MUSIC_EVENTS: MusicEvent[] = [];
for (let bar=0;bar<CHORUS.length;bar++) {
 let beat = bar*4;
 for (const [midi,beats] of CHORUS[bar]) {MUSIC_EVENTS.push({beat,kind:'melody',midi,beats});beat+=beats;}
 MUSIC_EVENTS.push({beat:bar*4,kind:'chord',notes:chords[bar]});
}
for (let beat=0;beat<LOOP_BEATS;beat+=.5) MUSIC_EVENTS.push({beat,kind:'sleigh',accent:Number.isInteger(beat)});
MUSIC_EVENTS.sort((a,b)=>a.beat-b.beat);
export const frequency = (midi:number) => 440 * Math.pow(2,(midi-69)/12);
