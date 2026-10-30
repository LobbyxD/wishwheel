# Wishwheel verification

Last updated: 2026-10-30. This describes checks actually performed, not an assertion of live production readiness.

## Theme, upload, wheel and turn-status update

- 62 automated tests pass, including actual component markup for image wedges (1, 2, 3, 12 and 50 slices), independent SVG clip IDs, private turn progress, picking-to-picked transitions, completion/reset, and the non-turn mode.
- Image-processing tests exercise resizing of a large phone photo, adaptive quality/dimension reduction, payload limits, unsupported/invalid file errors, and object URL cleanup using controlled image/canvas test doubles. Real browser photo decoding and the native file picker still need manual verification.
- Saved holiday/light/dark/system initialization is tested, including both system color schemes. TypeScript and the production build pass.
- The dev startup test verifies a busy API port, an isolated UI port, proxied room creation, and cleanup, while allowing the user's regular dev server to remain running.
- No browser surface was available for this update. Earlier browser observations below describe the previous interface; the new theme layout, animation and real-device upload flow have not been visually verified.

The subsequent Christmas redesign follows `design/holiday-interface-reference-v2.png` (1536×1024), generated with the built-in image tool. Matching transparent gifts and hanging ornaments are saved in `public/assets/`; their alpha channels and dimensions were checked. Exact prompts are in `design/holiday-redesign-prompts.md`. Holiday now defaults to a dark plum palette; appearance settings use `ww.theme.v2` so previous automatically saved defaults do not override it. Fresh explicit choices persist after that migration.

The homepage is implemented as real controls and an SVG wheel matching the reference composition, rather than a screenshot used as the page. Ambient effects include 32 shaped SVG snowflakes with depth and drift, 30 warm fairy lights, swaying ornaments, stardust, glowing wheel bulbs, and a winner burst. User motion preferences and the operating system's reduced-motion setting are honored. Component tests verify the reference text/actions, eight decorative wedges, lights, snowfall markup, Hebrew copy, and the default dark Holiday initialization. A pixel comparison to the generated reference remains unverified because no browser is connected.

Pointer effects add a small 16×22 desktop cursor with a subtle 5–8px sparkle trail and a twelve-particle burst for touch/pen taps. Input fields keep the native text cursor. Tests verify swipe/long-press/cancel suppression, passive input handling, the particle limit, reduced-motion cleanup, listener removal, and the absence of large desktop click bursts. The existing Christmas animations switch also disables pointer particles. Native cursor appearance and physical-device taps still need browser verification.

The cursor was subsequently redrawn from `design/cursor-reference-v3.png`: ivory/champagne fill, cranberry candy-cane bands and a thin gold edge inside the arrow. Both states retain identical 16×22 dimensions and `(2, 1)` hotspots. XML/source checks confirm their shared silhouette and dimensions. A saved **Use system cursor** preference restores native pointer sizing; custom cursors also fall back in forced-colors mode. This implements the user's selected standard-size custom design with a system-cursor option. No visual 1:1 browser comparison was available. See `design/CURSOR-NOTES.md`.

## Room management and long-term reuse

- Roster validation, exclusive concurrent claims, pre-start identity changes, complete-roster start gating, and identity locks after start are tested.
- Kicks are owner-only, cannot target the host, revoke the removed session, and reset an active round without partial assignments. Concurrent kick/spin behavior and hidden revocation hashes are covered.
- The public invitation preview exposes no private session/result/member-ID data and does not weaken private-state authentication.
- A real local API process was started, used to create/join/start/spin a prelisted room, stopped, and restarted with the same data directory. Results and owner authority survived; kick and access revocation worked afterward. A separate test advances application time by 366 days and verifies return/reset with the same room code and owner session.
- Recovery-file round trips retain more than twenty entries, preserve host access when merging, and reject malformed files without replacing saved entries. The room library renders all saved rooms without exposing tokens in HTML.
- New wedge interpolation grows from zero angle to its final share and preserves 360 degrees throughout. Reduced motion skips interpolation. Browser animation appearance, the native recovery-file picker/download and full interactive roster/kick dialogs remain unverified: the available browser inventory is empty.
- Local data is now persistent by default. No production schema, deployment, or connected Supabase project was changed in this update; new state fields fit the existing JSONB column.

## Passed

The current soundtrack is a newly coded instrumental Jingle Bells arrangement, replacing the original short motif. Four audio tests cover the complete chorus timing and accompaniment, single-instance playback, volume bounds, mute/graph cleanup, background timer recovery, and cancellation during audio-context resume. The production build passes. No audible browser or real-device check was available; sound quality and Safari behavior remain unverified. See `design/SOUNDTRACK.md` for provenance and arrangement details.

- TypeScript checks and Vite production build.
- 23 automated tests covering feasible matching, no-self/unique draws, repeats, mixed lists, simultaneous spins, capacity, duplicate-request recovery, turn timeout, stale generation/reset, owner-only controls, response privacy, hidden labels, token boundaries, rate limits, and modern/legacy Supabase key headers.
- Full dependency audit: zero reported vulnerabilities after pinning Vite 7.3.7. The exact audit output is `dependency-audit.json`.
- Browser preview of the implemented desktop interface. A discovered SVG label-positioning issue was corrected and the correction visually verified.
- Browser preview at an effective 388px mobile width: horizontal content width matched the viewport, Hebrew RTL was correct, and the dark-theme root contrast fix was visually verified.
- Generated icon, holiday scene and interface reference inspected. The interface reference is concept artwork, not an implementation screenshot.
- Production frontend contains no Supabase secret or database credentials. API responses are excluded from the service worker cache.

## Final source fixes checked by build/tests, not reverified in browser

- Stop ambient music on returning to Home, while retaining the saved mute preference.
- Wrap long unbroken room titles and result labels.
- Persist mute preference across reloads, translate decorative Hebrew labels, and use 16px mobile inputs plus safe-area insets.
- Preserve public UI assets offline; do not cache room API responses or private results.

## Still requires verification

- Full multi-participant browser playthrough, animation/reveal timing and recovery/reset flows across separate actual browser sessions. Automated backend tests cover their core correctness but do not replace UI testing.
- Live Supabase SQL provisioning, permissions/advisors and database concurrency in a real project.
- Vercel deployment, actual production routing/headers and a two-device end-to-end smoke test.
- Physical iPhone/Safari Home Screen installation, audio, native share sheet, and real-device accessibility behavior.

Local browser preview uses explicitly temporary in-memory test data. No production Supabase database or Vercel deployment was provisioned during this implementation.
