# Deploy on Vercel + Cloudflare Free

The frontend remains on Vercel. The room API runs on **Cloudflare Workers Free**, with **D1 Free** durable SQL storage. No paid plan, card, Supabase, Blob, or DNS changes are required by this architecture. Free quotas are finite: exhaustion causes errors, not a paid upgrade or transient storage fallback. Do not enable paid plans or automatic upgrades.

## Local checks

Use Node 24 (tests include built-in SQLite):

```sh
npm ci
npm test
npm run build
npm run dev
```

The existing local development API persists only to `.wishwheel/rooms.json`. It never accesses hosted D1. Keep that ignored directory private. To test the real Worker runtime locally, apply migrations with `npm run db:migrate:local`, then `npm run worker:dev`. A separate local config may use `ALLOWED_ORIGINS=http://localhost:5173`; never broaden production to `*`.

## One-time hosted setup (authorized account only)

1. Sign in to the intended Cloudflare account; verify **Workers Free**, not Paid. Create a D1 database named `wishwheel-data` on the Free plan. With authenticated Wrangler: `npx wrangler d1 create wishwheel-data`.
2. Put its returned nonsecret database UUID in `wrangler.jsonc` (`database_id`). Keep the binding named `DB`. No account API token belongs in Git or frontend variables.
3. Review and apply `npm run db:migrate:remote`. This creates Wishwheel's private room, rate-counter and Google-session tables in that selected database.
4. Set `ALLOWED_ORIGINS` to the exact frontend origin `https://wishwheel.lobbyx3.com`. Add preview origins individually only when intentionally granting preview access to this database. No wildcard or arbitrary forwarded-host validation.
5. Keep the existing Cloudflare project name **wishwheel**, matching `wrangler.jsonc`. When importing GitHub, the default build command `npm run build` and deploy command `npx wrangler deploy` are supported; no need to clear the build command or rename the project. Alternatively deploy with `npm run worker:deploy`. Note the actual HTTPS workers.dev endpoint. No DNS change is needed.
6. Set the destination of Vercel's `/api/wishwheel/:path*` rewrite to the actual Worker URL ending `/api/:path*`. Keep `src/deployment.ts` using the same-origin `/api/wishwheel/room` path so Google sessions use first-party HttpOnly cookies. The separate path avoids the older `/api/room` setup guard. These URLs are public, not secrets.
7. Run tests/build, push the reviewed code to GitHub, and wait for Vercel's deployment. No Supabase environment variables are used. Vercel serves the frontend and proxies `/api/wishwheel/*` to the same Worker over HTTPS. Requests and response cookies must pass through uncached.
8. Verify CORS preflight from the real frontend, room creation, independent guests, reload/recovery, draw, and reset. API responses must remain `private, no-store`. Do not claim production success before these checks.

**Future updates:** GitHub-to-Vercel deploys only the frontend. Changes to `worker/` or `server/` also need explicit Worker deployment; schema changes need reviewed D1 migrations. Do not assume pushing GitHub updates the Worker.

## Correctness and privacy

D1 stores each whole room with a revision. Every mutation conditionally updates `WHERE code=? AND revision=?`; a conflict re-reads and revalidates authentication, membership, generation and draw availability. The database's unique owner hash prevents duplicate rooms on concurrent create retries. No process-memory or filesystem production room fallback is present.

Names-only rounds prevent self-assignment. With removal enabled, each recipient is assigned once. Explicit repeats mode intentionally permits repeated items. Matching is calculated server-side before the round so the last guest cannot be stranded. Only a participant's own result is serialized; hosts see other guests' statuses, not their results. This is not end-to-end encryption: trusted Cloudflare account administrators can inspect the database.

Private recovery links/files contain member capabilities. They do not back up the database. Keep them private; names alone cannot recover an identity. Rooms have no automatic expiry, and reset preserves membership while replacing the round. Back up D1 separately and establish a retention policy before collecting real names.

## Free-tier operations

Current published free allowances include Workers 100,000 requests/day and 10ms CPU per HTTP request; D1 5 million rows read/day, 100,000 rows written/day and 500MB per database. Index updates also consume write allowance. Check the account dashboard and official limits before launch; free does not mean unlimited availability.

Polling pauses in hidden/offline tabs, uses 5-second intervals throughout active rounds, including after a participant's own result, and 15 seconds in the lobby or completed room. Returning to the tab immediately refreshes and re-blurs the result. Scheduled cleanup removes expired rate counters and Google sessions hourly, not room data. Do not enable response caching for authenticated state. Logs/analytics must not include tokens, recovery fragments, full state or request bodies.

Test at least one full names-only round for each size 4–20, plus simultaneous duplicate spins, concurrent joins, reload, owner reset racing a spin, stale-generation rejection and host/guest response privacy. Automated SQLite tests are not a substitute for final Worker and production-browser tests. Local wall-time/CPU measurements do not prove Cloudflare's CPU accounting.

References: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 consistency](https://developers.cloudflare.com/d1/best-practices/read-replication/).

## Google sign-in activation

Set the public `GOOGLE_CLIENT_ID` in `wrangler.jsonc`, register the website origin in Google Cloud, apply migrations before deploying the Worker, then deploy the updated Vercel frontend. No client secret is needed. See [Google sign-in setup](GOOGLE-SIGN-IN.md). Guest access remains available without Google configuration.

## Live room notifications

Deploy the root Wrangler configuration, including the `ROOM_LIVE` binding and `room-live-v1` migration with `new_sqlite_classes`. Wrangler creates the notification namespace while retaining the existing D1 database. The browser uses HTTPS through Vercel to request a private subscription ticket, then WSS directly to the Worker. Keep the committed `wss://wishwheel.daniel1233212.workers.dev` CSP entry. Local `npm run dev` provides the same ticket/event protocol through a Node WebSocket server and Vite proxy.

SQLite-backed Durable Objects are available on Workers Free; no paid-plan change is required. Provider quotas still apply. References: [Cloudflare overview](https://developers.cloudflare.com/durable-objects/), [hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
