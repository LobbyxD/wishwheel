# Christmas cursor reference and implementation

Reference: `cursor-reference-v3.png`, generated with the built-in image generation tool. Exact prompt: `cursor-reference-v3-prompt.md`.

The app SVGs trace the reference's slim arrow silhouette, burgundy outline, fine gold inner edge, and three clipped cranberry ribbon bands. The default fill is warm ivory; the interactive fill is pale champagne. Both assets use the same 16×22 CSS-pixel footprint, viewBox and `(2, 1)` click hotspot. The enlarged specimens on the reference board are inspection views, not the app's cursor size. There is no hover enlargement or JavaScript cursor replacement.

- Default: `public/cursors/christmas-arrow.svg`
- Interactive: `public/cursors/christmas-pointer.svg`
- Cursor rules and native fallbacks: `src/pointer-magic.css`

The selected behavior is **custom design at standard size, with a system-cursor option**. Preferences → **Use system cursor** preserves the actual pointer supplied by the user's device. This choice is saved in `ww.cursor` and applied before the page paints. Particles remain independent. Text entry and disabled controls retain their native cursor roles. Touch-only devices do not receive a custom mouse cursor. Forced-colors mode uses native cursor keywords.

The 16×22 footprint is a standard-size choice, not a claim that the website has measured the OS cursor. [CSS cursor sizing is browser-defined](https://www.w3.org/TR/css-ui-4/#cursor), and [custom cursor scaling can differ from Windows pointer-size settings](https://bugzilla.mozilla.org/show_bug.cgi?id=1609827). The native option is provided for exact system shape and size.

The source SVGs are XML-validated and share identical dimensions and silhouette geometry. Browser-level pixel comparison and cursor appearance remain unverified because no browser surface is connected.
