# Wishwheel ✦

A Christmas roulette room app for asynchronous gatherings. Create a room, share a six-character code, gather your people, and give everyone a private surprise.

## Features

- Names, a custom list, or both; always excludes your own name.
- Optional one-time items and randomly ordered turns. Feasibility checked before a round starts.
- Persistent private results, blurred until tapped, with private recovery links for another device.
- Host sees progress, not other participants’ results. Reset returns everyone to a fresh lobby.
- Visible or covered animated wheel, custom color/image covers, a synthesized instrumental bell arrangement, and reduced-motion support.
- English/Hebrew/system language, RTL, holiday/light/dark/system themes, and iPhone Home Screen installation.
- Custom PNG/JPG/WebP photos up to 20 MB, automatically resized into image covers with a separate wedge for each wheel item.
- A visible randomized turn queue, highlighted current player, live picking/picked badges, and round progress without revealing anyone else's result.
- Dark Holiday appearance by default, with a generated Christmas design reference, illuminated wheel, animated snowflakes, fairy lights, gift artwork, and hanging ornaments. Preferences include a switch for quieter animation; system reduced motion is also respected.
- Animated wheel slicing as the guest list grows, owner-only guest removal, and prelisted rooms where guests claim a name and identities lock when the round starts.
- A searchable room library without the old 20-room limit, private recovery-file export/import, and persistent local room data for later reuse.
- Generated Christmas imagery, app icons, and design reference in `design/`.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

If Windows PowerShell reports that `npm.ps1` cannot run because scripts are disabled, use `npm.cmd` instead; no execution-policy change is needed:

```powershell
npm.cmd ci
npm.cmd run dev
```

Install dependencies before the first launch. Open the local URL printed by Vite (usually `http://127.0.0.1:5173`).

If API port 3001 is already occupied, startup automatically selects an available local port and connects the UI to it. Stop the development server with Ctrl+C before restarting it.

This starts the Vite UI and a local API that saves rooms to `.wishwheel/rooms.json`. Rooms survive server restarts and have no automatic expiry. The directory is ignored by Git. This local API does not connect to Supabase and is never imported by the production API. Automated tests and `WISHWHEEL_VOLATILE=1` use temporary memory storage instead.

Restart the development server after updating backend files. Rooms that existed only in an earlier version's temporary process cannot be recovered after that old process stops.

```sh
npm test
npm run build
```

## Publish with Vercel + Supabase

1. Create a separate Supabase project and run `db/bootstrap.sql` in its SQL editor.
2. Import this GitHub repository into Vercel. The Vite framework, build command, and output directory are set in `vercel.json`.
3. Set **server-only** environment variables `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel. A legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported. Never put either secret in a `VITE_` variable.
4. Deploy, then run the two-device smoke checklist in [the deployment guide](docs/DEPLOYMENT.md).

No catch-all rewrite is needed: share and recovery links use the root URL with a room query. `/api/room` must remain a Vercel serverless function, not an SPA rewrite.

**This source is ready for setup, not an already provisioned production service.** No live Supabase schema or Vercel project is created by cloning it.

## Privacy and identity

A room code is an invitation, not authentication. Each participant gets an unguessable device capability. Keep private recovery links and files private: anyone with either can access that participant’s result and role. A name alone cannot reclaim another participant’s place. The room library remembers places on the same browser; download a recovery file before changing devices or clearing browser storage.

## Reuse a room next year

Open **Your rooms**, choose a room you created, and use **Start a fresh round**. Membership and the room code remain, while previous results are cleared. No application expiry removes an idle room or its private capability.

Use **Download private recovery file** in a room, or **Back up all rooms** in the library. Import that file on another browser to restore your saved room entries and role. The file stores access credentials, not a copy of room data: the room must still exist on the backend. Keep the Supabase database, or the local `.wishwheel` directory and its backups, for as long as the rooms are needed.

Prelisted rooms require 2–50 distinct names including the host. Guests select an unclaimed name; they can change it in the lobby and are locked into it when everyone is ready. Removing a guest revokes their current private session and frees their listed place. Removing someone during a round also resets the round for everyone to preserve valid assignments.

Supabase stores only hashes of participant tokens. The browser receives only its own assignment. Public database access is disabled by RLS and grants; mutations use atomic compare-and-swap to prevent duplicate concurrent picks.

The soundtrack is a locally synthesized instrumental arrangement of Jingle Bells, with chiming bells, quiet chords and sleigh bells. It contains no lyrics or third-party recordings. See [soundtrack notes](design/SOUNDTRACK.md). Audio starts only after interaction and can be muted. Home Screen installation is supported; **offline multiplayer/picking is not**. A connection is required to load or update a room.

Further details: [API and security design](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) · [Verification status](qa/VERIFICATION.md) · [Acceptance checks](qa/ACCEPTANCE.md) · [Generated visual assets](design/ASSET-NOTES.md).
