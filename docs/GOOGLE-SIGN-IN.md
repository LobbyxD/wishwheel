# Google sign-in on Cloudflare and Vercel

Wishwheel uses Google Identity Services with the Cloudflare Worker and D1. Guests can use private invitations without a Google account. Supabase is not required.

## Activate Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/auth/clients), select your project and configure the Google Auth Platform branding and audience. Add your testers if the app is in Testing mode.
2. Create an OAuth client with application type **Web application**. Add these **Authorized JavaScript origins**:
   - `https://wishwheel.lobbyx3.com`
   - `http://localhost`
   - `http://localhost:5173`
   Use the exact site origin, with no path. Add any other frontend origin you actually use. This implementation uses the Google JavaScript callback, so it needs no OAuth redirect URI.
3. Copy the public client ID ending in `.apps.googleusercontent.com`. Set `vars.GOOGLE_CLIENT_ID` in `wrangler.jsonc`. Do not add a client secret; this sign-in flow does not need one.
4. Ensure the real D1 database ID is set in the same configuration. Apply migrations, including `0002_google_sessions.sql`, and deploy the Worker:

   ```sh
   npm run db:migrate:remote
   npm run worker:deploy
   ```

5. Deploy the updated frontend to Vercel. Its `/api/wishwheel/*` rewrite must proxy to the Worker without caching responses or stripping `Cookie`/`Set-Cookie`. The committed CSP permits the Google sign-in script, frame, connections and styles.
6. Check `/api/wishwheel/auth/session` through the website. It should return the configured public `clientId`, a nonce, and `user:null` before sign-in. A successful Google sign-in sets an HttpOnly cookie and displays the account name.

Google's [client setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) explains origin registration and browser headers. Its [ID-token verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) describes the verification rules.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and set the same public `GOOGLE_CLIENT_ID`. The development launcher reads this file and optional `.env.local` before starting the API. Restart `npm run dev` after changing configuration.

Open `http://localhost:5173` so the origin matches Google's registration. If Vite selects another port, register that exact origin too. No configuration is required for guest access; without a client ID the interface explains that Google sign-in is unavailable.

## Private invitations

- Create a **Prelisted people** room and include your own name. The host receives one distinct six-character alphanumeric code per person, with copy-code and copy-private-invitation controls. Send each invitation privately to its intended recipient.
- Guests enter the room code and their private code. There is no public name selector. A private invitation link fills in both codes and immediately removes the private fragment from the address bar.
- Plaintext invitation codes are displayed only when issued and kept only in the current page's memory. D1 stores salted hashes. After reloading, the host can generate a replacement code to send again.
- Replacing a guest code invalidates the previous code and guest session/return link. Joining with the replacement restores the same participant and result. Keep guest codes and recovery files private; the host is trusted with guest access.
- Joining while signed in with Google, or signing in while viewing an existing guest place, permanently links that place to the verified Google account. One Google account has one place per room. Returning to the room while signed in resumes that place automatically.
- Once linked, a private code or copied recovery file alone cannot open the place. Regenerating its code, resetting the round or removing/reinviting the person preserves the Google binding. The host cannot change the linked Google account through room controls.
- Google sessions last 30 days. The room binding has no automatic expiry: after a year, sign in with the same Google account and open the room link again. Keep the room link or recovery file, and retain the D1 database.

## Verification before sharing

Use separate browser profiles for the host and two guests. Verify private-code joining, code replacement, Google linking, returning without a device token, and signing out. Try the Google-linked person's code and private return link in an unsigned profile and another Google account; both must be denied. Repeat after code rotation and room reset.

Automated tests verify signed ID tokens (signature, issuer, audience, expiry and nonce), Worker cookies/logout, account binding, private-code hashing and access, guess limits, SQLite migrations and persistent local sessions. A real Google browser sign-in and the deployed Vercel/Cloudflare cookie proxy still require a live smoke test.
