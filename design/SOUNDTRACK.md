# Wishwheel soundtrack

The first version used a short, original winter motif synthesized in `src/music.ts`; it did not use an external recording.

The current version performs a newly coded instrumental arrangement of **Jingle Bells**, composed by James Lord Pierpont. The composition is not an original Wishwheel melody. Historical score reference: [Library of Congress — The one horse open sleigh](https://www.loc.gov/item/2023812429/).

The arrangement uses a 16-bar chorus at 110 BPM, chiming bell partials, quiet lower-register chords, synthesized sleigh bells, and a short generated room reverb. It contains no vocals, lyrics, sampled instruments, or third-party recordings. All sound is generated locally with Web Audio.

The audio clock schedules notes ahead of playback for steadier timing. Returning from a throttled background tab restarts the phrase without a burst of missed notes. Mute fades the output, stops queued voices, and disconnects the graph; volume and the saved mute preference continue to work.

Automated checks cover score timing, note/accompaniment scheduling, repeated play calls, volume bounds, mute/cleanup, throttled timers, and stopping during a pending audio resume. Actual sound quality and Safari playback still require an audible browser check.
