# Publish Wishwheel from GitHub to Vercel + Supabase

The repository is a complete Vite/React frontend with a Vercel Node function and a private Supabase PostgreSQL backend. It is **not a hosted deployment until you complete the steps below**. No credentials are committed.

## 1. Run and check it locally

Use Node.js 22.12 or later (Node 24 recommended).

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` starts Vite plus a **temporary, local-only** API on port 3001. Follow Vite's printed URL (normally http://localhost:5173). It deliberately does **not** connect to Supabase, even if you have environment variables set. All test rooms disappear when you stop it. Use separate browser profiles/private windows to simulate people. Do not treat local rooms or recovery links as production records.

For production-like testing, deploy to a Vercel preview project/environment wired to a **separate test Supabase project**, then complete the smoke tests below. The browser test harness does not substitute for testing the real database, Vercel routing, environment variables, and permissions.

## 2. Create a dedicated Supabase project

1. Sign in to Supabase and select the organization you want to use.
2. Create a dedicated project named Wishwheel. Choose a nearby region. Review the quoted price and plan limitations before confirming. Do not reuse another application's database unless you intentionally accept sharing that project's administrative/security boundary.
3. Wait until the project is healthy.
4. Open the SQL Editor. Copy the **entire** contents of `db/bootstrap.sql`, review it, and run it once. This creates only the two `wishwheel_` tables and two RPCs needed by the application.
5. Verify both `wishwheel_rooms` and `wishwheel_limits` show RLS enabled. There should be **no anon/authenticated table policies granting access**. The application intentionally does not use browser-side Supabase access.
6. Run the following read-only checks in the SQL Editor. Both `relrowsecurity` values should be true, and all three privilege checks should be false:

```sql
select relname, relrowsecurity
from pg_class
where oid in ('public.wishwheel_rooms'::regclass, 'public.wishwheel_limits'::regclass);

select
  has_table_privilege('anon', 'public.wishwheel_rooms', 'SELECT') as anon_can_read,
  has_table_privilege('authenticated', 'public.wishwheel_rooms', 'SELECT') as authenticated_can_read,
  has_function_privilege('anon', 'public.wishwheel_cas(text,bigint,jsonb)', 'EXECUTE') as anon_can_mutate;
```

7. Run Supabase's Security Advisor and review findings. Never fix a permissions warning by broadly granting these tables to anon/authenticated or disabling RLS.
8. Copy your project URL and **server-only secret API key** (`sb_secret_...`) from Project Settings → API Keys. Keep this key private; do not substitute an anon/publishable key. Modern secret keys are sent only in the `apikey` header. The implementation also accepts legacy `service_role` JWT keys through the fallback variable `SUPABASE_SERVICE_ROLE_KEY`, but modern secret keys are preferred.

The service key can access the project's data. Prefer a dedicated project. Do not paste it into a chat, commit it, add it to a browser variable, or share a screenshot containing it.

## 3. Import the GitHub repository into Vercel

1. In Vercel, choose Add New → Project → Import Git Repository and select this repository.
2. Choose the intended Vercel account/team. Review any plan or billing implications before proceeding.
3. Set the repository root as Root Directory (unless you intentionally imported a parent monorepo).
4. Set Framework Preset to **Vite**, Install Command to `npm ci`, Build Command to `npm run build`, and Output Directory to `dist`. Use Node.js 24.x.
5. Add these environment variables through Vercel's secure environment-variable interface:

| Name | Value | Exposure |
| --- | --- | --- |
| `SUPABASE_URL` | The dedicated project's HTTPS URL | Server only |
| `SUPABASE_SECRET_KEY` | The dedicated project's secret API key | Secret, server only |

Do not prefix either with `VITE_`, `NEXT_PUBLIC_`, or any other public prefix. Mark the key sensitive when Vercel offers that setting. Set Production; add Preview only if previews should use that database. Prefer a separate test project for Preview so test resets do not affect production rooms.

6. Deploy. Vercel discovers `api/room.js` as a Node function and builds the frontend. Keep the repository's `vercel.json`; its routing must preserve `/api/room` rather than rewriting API requests to `index.html`.
7. If you add or change environment variables after deployment, redeploy so the running function receives them.
8. Open the deployment URL. If Vercel Deployment Protection is enabled, guests cannot use the app until its sharing/protection settings permit them. Decide the intended public audience in Vercel before sending invitations. Changing that protection is an account security choice, not an application setting.
9. Use your final production domain for invitations. Preview URLs can change, and recovery links are tied to the URL origin where local sessions are stored.

## 4. Production smoke test before inviting real guests

Use temporary rooms and at least three separate browser profiles/devices.

1. Create a room with a limit of three. Copy/share the six-character invitation code/link; verify it does **not** contain a private token.
2. Join two guests. Reload each page and verify saved identity returns. Try duplicate names, a fourth guest, an invalid room code, and a copied room URL without a session. None should expose another person's result.
3. Start the names-only room. Verify late joins are blocked. In turn-based mode, out-of-turn spins should be rejected.
4. Spin on the first device, close its tab during animation, and verify the next participant can act after the six-second picking lease.
5. Complete all participants. Every person must receive a non-self name; with removal enabled, no two results may be the same.
6. Inspect host state/network responses. They must show only statuses for other participants, never their assignments. A hidden custom wheel must not reveal its labels to guests before their own result.
7. Reload a result page. The result is blurred until tapped. Use its **private recovery link** in a fresh browser and verify it recovers only that member. Keep that link out of public messages and screenshots.
8. Host-reset the room. All results must disappear and membership stay intact. Start another round. Old in-flight actions from the previous generation must be rejected, not consume fresh items.
9. Test custom-only and mixed lists, insufficient items with removal on, and explicit repeats mode. Repeats mode may repeat custom items across people but still cannot select the person's own canonical name.
10. On iPhone Safari, test English/Hebrew RTL, system/light/dark, sound after a user gesture, Reduce Motion, Share, and Add to Home Screen. iOS does not allow unsolicited autoplay; the music control intentionally needs a tap.
11. Inspect Vercel function logs and Supabase Security Advisor for unexpected errors. Do not log authorization headers, private recovery links, or full room state to diagnose them.

## 5. Privacy, recovery, retention, and operational limits

- Room codes permit joining, **not authentication as an existing member**. Names are unverified display labels. Anyone with an invitation can join before the host starts if capacity remains.
- A saved 256-bit capability token authenticates each member. Only its SHA-256 hash is stored in Supabase. The original token stays in the device's local storage and in a private recovery link if copied.
- Recovery links carry the secret in a URL fragment rather than a query, and the app clears it after import. Anyone who obtains the link can access that member's result, or host controls if it is the host's link. Do not send a host recovery link as the invitation.
- If both device storage and the recovery link are lost, entering the same name does not recover the account. There is no email/password reset flow. If a recovery link is leaked, there is currently no individual token-rotation UI; retire that room and create a new one.
- Host privacy means **the room host inside the app** cannot read others' results through the API. This is not end-to-end encryption: Supabase project administrators and anyone holding its service key can inspect stored room state. Use trusted administrators and restricted access.
- Blur is a shoulder-surfing convenience, not cryptographic protection against someone controlling that device. Small groups or a known item pool can permit logical deductions; the app cannot prevent deduction from outside knowledge.
- Assignment is randomized using secure randomness. Matching prevents deadlocks but does not claim uniform probability over all possible constrained matchings.
- Results and rooms are currently retained until an administrator deletes them. A host reset discards the current round's assignments, preserving the room and participants. No scheduled retention cleanup or account deletion UI is included.
- Rate-limit counters expire and are opportunistically cleaned. Requests are throttled by hashed IP/session identifiers. No advertising, analytics, or third-party tracking scripts are required by the app.
- Establish a retention period before collecting real participant names. Back up the dedicated database using the options available on your Supabase plan, and verify restoration separately. Plan backup retention, point-in-time recovery, inactivity pausing, quotas, and costs vary; do not assume the Free plan guarantees uninterrupted service or backups.
- Source code in GitHub does **not** back up room data. Deleting/recreating Supabase loses rooms unless you restore a database backup. Keep Vercel secrets out of source backups.
- Check project health and usage in Supabase/Vercel when diagnosing outages. Missing credentials produce a service-configuration error, never a silent fallback to a fake in-memory production room.

## Implementation reference

See `docs/API.md` for the request/response contract, state machine, draw algorithm, and detailed boundaries. Automated tests are under `tests/`. Local SQL verification evidence is under `qa/`; it is not proof that your newly created hosted project was configured correctly.

API key setup follows [Supabase’s current API keys documentation](https://supabase.com/docs/guides/getting-started/api-keys).
