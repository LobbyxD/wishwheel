# Wishwheel

Wishwheel is a private roulette room for exchanging names or custom items with a group. Create a room, share its six-character code, and let each participant privately reveal their own result. The app supports turn-based or open play, optional one-time picks, prelisted guest names, English and Hebrew, and installable mobile layouts.

## Run locally

Requires Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (usually `http://127.0.0.1:5173`). In Windows PowerShell, if the `npm` command is blocked by script policy, use `npm.cmd`:

```powershell
npm.cmd ci
npm.cmd run dev
```

The development command starts the Vite app and a local-only API. Rooms are saved on this computer in `.wishwheel/rooms.json`, so they survive server restarts. Back up that directory if you need to keep local rooms; it contains private room data and is excluded from Git. Set `WISHWHEEL_DATA_DIR` to store it elsewhere. Local development never connects to production Cloudflare D1. Automated tests use temporary in-memory data.

Useful commands:

```sh
npm test       # run the automated test suite
npm run build  # type-check and create the production build in dist/
npm run preview # serve the production build locally
```

The local API normally uses port 3001. If that port is occupied, it chooses a free port and the development app connects to it automatically.

## Deploy

Wishwheel uses a Vite frontend on Vercel and a Cloudflare Worker with private D1 storage. Use **Workers Free + D1 Free only**; no paid upgrade, Supabase, Blob, or browser database credentials.

Follow [the deployment guide](docs/DEPLOYMENT.md). Create the private D1 database, apply `worker/migrations`, deploy the Worker, then set its public API URL and exact CSP origin before pushing the frontend. GitHub pushes deploy Vercel; Worker code and D1 migrations have a separate explicit deployment step.

## Privacy and recovery

A room code lets someone join an open room; it does not prove their identity. Each participant has a private device capability. Recovery links and exported recovery files contain that capability, so anyone who receives one can access that participant’s result and, for the host, room controls. Keep them private. A name alone cannot recover a participant’s place.

The browser stores room entries on that device. Use the in-app recovery or backup options before changing devices or clearing browser storage. Recovery files contain credentials, not room data; the corresponding room must still exist on the backend. Production room data remains in Cloudflare D1 until removed by an administrator. Local room data remains in `.wishwheel/rooms.json` until that file is removed.

The soundtrack is synthesized locally and begins after user interaction. Home Screen installation is supported; loading and updating rooms still requires a network connection.

## Project documentation

- [API and security design](docs/API.md)
- [Deployment and production smoke checks](docs/DEPLOYMENT.md)
- [Acceptance checks](qa/ACCEPTANCE.md)
- [Verification notes](qa/VERIFICATION.md)
- [Generated visual assets](design/ASSET-NOTES.md)
- [Soundtrack notes](design/SOUNDTRACK.md)
