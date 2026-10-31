# Result reveals and shared turns

The update is based on `cf53a26`, pulled from `origin/main` on 2026-10-31. Earlier uncommitted work was saved in the Git stash named `codex-before-latest-wheel-animation-2026-10-31`. The account/invitation work was adapted to the current `worker/`, `server/store.mjs` and root Wrangler configuration; the old parallel `cloudflare/` implementation was not restored.

## Personal reveal

1. A successful spin animates the wheel for 4.8 seconds; the server picking lease remains six seconds.
2. After the spin, the actual slice shape and cover crop lift from the wheel into a private dialog. It twirls through several turns, slows down and stops on its back.
3. The result text appears only after the flip completes. Keyboard focus stays in the dialog; the rest of the app is inert.
4. Closing or pressing Escape makes the text vanish, morphs the slice into a rectangle, and moves it to the result card below. On small screens the destination is scrolled into view before the move.
5. The permanent card remains hidden until tapped. A saved result reopened later does not replay this dialog. Reset, removal or navigation cancels the pending animation and restores normal interaction.
6. The app motion toggle and OS Reduce Motion preference skip travel, twirling and particle motion while preserving the reveal and close controls.

## Other players

Visible clients continue polling during active rounds, even after receiving their own result. Public spin start/end timestamps let them animate current turns and celebrate a turn completed between polling ticks. The shared wheel rotation is decorative: no other person's item or landing angle is transmitted. Completed historical turns do not replay when someone rejoins. Concurrent non-turn spins can share a celebration.

## Automated evidence

The DOM tests mount the actual React portal and control Web Animations promises. They verify the private label appears after the flip, disappears before docking, the destination stays hidden, Escape works, reduced-motion durations are zero, and unmount cancels animations/restores focus and scrolling access. Geometry is checked for 1–100 slices. Activity tests cover missed polling ticks, replay suppression, own-player exclusion and the server's safe public projection.

The tests use Happy DOM, not a browser rendering engine. They verify behavior and sequencing but cannot prove visual appearance, GPU compositing, Safari backface rendering or touch layout.

## Browser checks still needed

- Use three browser profiles. Create a room and spin while the other two watch. Spectators should see the named player, generic wheel motion and sealed-gift celebration, with no selected item in their network response or DOM.
- In the spinning profile, check the slice's departure, quick twirl, readable back, word vanishing and movement into the hidden result card. Try a custom image, a solid cover, a visible wheel, 2/50/100 slices, an 80-character label, and Hebrew.
- Close with the button, backdrop and Escape; Tab/Shift+Tab should stay inside until dismissal. Reload or revisit afterward: only the hidden saved result should remain.
- Reset from another profile while spinning, while the popup is open and while docking. No old popup or result should return.
- Repeat with reduced motion and on iPhone Safari. Check the destination stays on screen in both portrait and landscape, no horizontal overflow occurs, and the result requires a tap to reveal again.
- Google sign-in needs its configured public client ID, migration and updated Worker/Vercel deployment. Test cookies through the production `/api/wishwheel/*` proxy and attempt a Google-locked person's invitation from another account and unsigned browser.

The release follow-up deployed the Worker and confirmed the production session table; see `qa/VERIFICATION.md`. Frontend releases follow pushes to `main`. A real browser playthrough remains outstanding.
