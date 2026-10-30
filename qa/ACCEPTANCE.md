# Wishwheel acceptance checklist

## Draw correctness and privacy
- Start rejects impossible matching before changing room state; name-only rooms require enough members.
- Name normalization prevents a player drawing themselves, including custom labels equal to their name.
- Removal enabled: every assigned item is unique across players, including simultaneous requests.
- Removal disabled is explicitly described as allowing repeated items, never self picks.
- Concurrent/repeated spin calls return one stable result; no double consumption.
- Owner can read participant statuses but not their assignments, future assignments, or capability tokens.
- Room code/name alone cannot recover or impersonate an existing participant.
- Hidden-wheel state and responses contain no unrevealed labels; revealing own result does not reveal others.

## Lifecycle
- Six-character uppercase alphanumeric codes are unique, easily copied/shared, and collision-safe.
- Concurrent joins obey capacity, unique names, and lobby-only joining.
- Owner can configure room before invite/start and freeze membership with everyone-is-in.
- Async participants remain in room and may rejoin via their saved private session.
- Optional turn mode uses stable random order and prevents out-of-turn spins.
- Picking status eventually completes even after tab closes; no permanent stuck turn.
- Reset starts a new generation, restores pool, and invalidates stale spin/reveal responses.
- Saved result stays stable across refresh/rejoin and is blurred until explicit reveal.

## UI and platform
- Mobile layout fits 320–430px without overflow; touch targets and iPhone safe areas are usable.
- Wheel spins and winning slice pops outward, pauses, then shows result.
- Hidden wheel can be color or image and does not accidentally show labels.
- Christmas music is user-gesture initiated, muteable, and does not resume unexpectedly.
- Reduced motion support avoids unnecessary animation.
- English/Hebrew/System languages work with Hebrew RTL and translated errors/actions.
- Light/Dark/System themes work and follow system changes when selected.
- Web manifest, 192/512 icons, Apple touch icon, standalone behavior and metadata are valid.
- API/network errors, expired session, invalid code, room full, invalid list, copy failure and reset confirmation are understandable.
