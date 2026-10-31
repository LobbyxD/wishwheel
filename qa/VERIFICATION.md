# Wishwheel verification

Last updated: 2026-10-31. This describes checks actually performed, not an assertion of live production readiness.

## 2026-10-31: ink dissolution

Closing the result now erodes the stationary native text with a fine SVG alpha-noise mask. Canvas particles are sampled from the glyph pixels, rise and disperse for 1.5 seconds, then clear before the slice starts its return spin/morph. The earlier moving/blurred label and generic golden particles were removed. Reduced motion skips the effect; unavailable Canvas falls back to a stationary fade. All 100 tests and the production build pass, including glyph-only emission, mask progression, upward dispersal, cancellation/cleanup, and absence of text translation/blur. No connected browser surface was available to verify appearance visually.

## 2026-10-31: natural text and shared wheel path

The earlier aspect-ratio change left SVG `textLength`/`spacingAndGlyphs` forcing result letters to estimated widths. Result labels now use normal HTML typography fitted by actual DOM width/height measurements; only font size and wrapping change. Popup surfaces and the original wheel now share the same SVG sector path, with one uniformly scaled wheel canvas and a smaller maximum reveal size. All 98 tests and the production build pass. DOM tests confirm no forced glyph-width attributes remain and cover long/Hebrew labels. Browser inventory is empty and opening the in-app browser reports it is unavailable, so final appearance has not been visually verified.

## 2026-10-31: extracted slice proportions

The reveal previously stretched every sector into an independently sized square/rectangle. Popup dimensions now come from the original sector's bounding-box ratio and fit inside the viewport with one uniform scale. The arrival transform and image crop also preserve their aspect ratios; nonuniform scaling is reserved for the intentional rectangle morph on close. Regression tests cover 1/2/3/4/6/8/12/50/100 slices on desktop, portrait and landscape, plus the actual React popup dimensions. All 97 tests and the production build pass. No browser surface was available for visual verification.

## 2026-10-31: expandable guests, floating reveal and live room updates

Release checks: all 96 tests pass, including the actual Cloudflare runtime and local Vite WebSocket proxy; TypeScript/Vite production build passes. Worker version `91fe1032-d473-461c-a2c2-829856c60c32` is deployed with the SQLite notification binding. A temporary production probe measured join/spin notifications at 415/411 ms respectively, confirmed no result was broadcast, and accepted a capacity of 1,000. Only that new, explicitly marked probe room was removed afterward. These measurements are one network smoke test, not a general latency or capacity guarantee.

- Guest creation now uses individual Add another/remove fields without the old 50-person cap. Tests render more than fifty fields and exercise complete, non-self matching for 10,000 people in names/mixed pools with and without unique picks. This tests the matching engine, not a claim of 10,000 hosted concurrent users.
- The opaque reveal panel is removed. The slice grows while twirling, reveals fitted SVG text on its back, vaporizes the text, then spins again while morphing/docking into the hidden result card. DOM tests cover long unbroken results and Hebrew; no result text uses a scroll container.
- Live room notifications run through authenticated, single-use tickets and a hibernating SQLite Durable Object. The real workerd/Miniflare test covers upgrade, ticket reuse rejection, immediate join/spin events and reset. A second integration test exercises the real local Vite WebSocket proxy. Google locks are enforced at ticket issuance.
- Client tests cover immediate public state, stale-response reconciliation, independent events delivered out of order, locally timed turn completion, and preservation of private results. Returning Google users no longer wait for profile/preview requests in sequence.
- Browser surfaces remain unavailable. DOM/runtime checks do not verify final GPU appearance, Safari compositing or real Google browser login.

## 2026-10-31: latest source, animated reveals and private accounts

Release follow-up: the Google OAuth client ID is now configured. Remote migration checks report no pending migrations, and the production D1 database contains `wishwheel_google_sessions`. The Worker was deployed successfully as version `4306146c-a1b1-457c-93c4-2a321cc2326c`. Its live auth session endpoint returns HTTP 200 with the configured public client ID, an anonymous user and an HttpOnly/Secure nonce cookie; an invalid Google credential is rejected with HTTP 401. All 88 tests and the production frontend build pass before the authorized push to `main`. A real Google account browser sign-in remains unverified.

- Pulled `origin/main` with a fast-forward to `cf53a26`; prior uncommitted changes remain saved in the named Git stash. Restored account/private-invitation work against the current Worker/D1 backend.
- All 88 tests pass, including actual React portal behavior under Happy DOM and SQLite-backed Worker tests. TypeScript/Vite production build passes. Wrangler 4.156.0 `deploy --dry-run` successfully bundles the Worker against the configured existing D1 binding; it does not deploy or migrate anything.
- DOM tests exercise twirl/reveal, text vanishing, morph/docking, hidden saved result, Escape, reduced motion and reset/navigation cancellation. Backend tests verify spectator timing excludes selected items and angles, and Google locks cannot be bypassed with copied or regenerated codes.
- No browser surface is connected. GPU/compositing appearance, real Google sign-in, iPhone/Safari behavior and the deployed Vercel cookie proxy still need browser verification. `GOOGLE_CLIENT_ID` is empty; apply the new session migration and configure that public ID before enabling Google login.
- Detailed checks: `docs/DRAW-EXPERIENCE.md` and `docs/GOOGLE-SIGN-IN.md`. Earlier evidence below describes older source states.

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
