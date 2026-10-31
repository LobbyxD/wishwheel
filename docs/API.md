# Wishwheel API and deployment

## Deployment configuration

- Vite React frontend on Vercel; public API implemented by `worker/index.mjs` on Cloudflare Workers Free.
- Private D1 binding `DB`, schema in `worker/migrations/`, including Google sessions in `0002_google_sessions.sql`.
- Exact frontend allowlist `ALLOWED_ORIGINS`; CORS allows Authorization/Content-Type. Production browsers use Vercel's same-origin `/api/wishwheel/*` rewrite to keep session cookies first-party; cross-site credentialed CORS is not enabled.
- Production endpoint is public metadata in `src/deployment.ts`; CSP must allow that exact Worker origin.
- No Supabase, Blob, public database access, or Vercel application secrets.

## Requests

Worker POST `/api/room` JSON `{action,code?,name?,settings?,generation?,inviteCode?,slotId?}` with a participant bearer token and/or a verified Google session cookie. Production frontend path: `/api/wishwheel/room`.
GET `/api/room?code=ABC234` is also supported for state.
Actions: `create`, `join`, `state`, `start`, `spin`, `reset`, `preview`, `identify`, `kick`, `issue-invites`, `regenerate-invite`.
Create needs name/settings; open joins need code/name, and prelisted joins need the room code plus private `inviteCode`. All existing-room actions need code.
Start/spin/reset require current integer generation. Reset increments generation and returns lobby, retaining membership.

`preview` requires only the room code and returns `{code,title,phase,participantMode,memberCount,maxMembers,people:[],requiresPersonalCode,canResume}`. No name selector or private data is public. `canResume` is true when the verified Google account already has a place in this room. Private state requires the participant capability or the same linked Google account.

`identify` requires `name`, current `generation`, and the participant token; changes are allowed only for open-room lobby names. Prelisted identities are fixed by their private code. `kick` requires `memberId`, current `generation`, and the owner token. The host cannot kick themselves. Removal revokes the old capability and private code, frees the roster place, increments generation, clears assignments/results and returns the room to the lobby. Google binding is retained, so a replacement invitation cannot bypass it. The UI confirms the effect before sending the request. An invitation code still permits a new session to join an open place; names are not verified real-world identities.

Generate a pending token with browser crypto before create/join: 32 random bytes encoded base64url (43 chars). Save it before request; it makes uncertain-response retries safe. Create reuses existing room for the same owner token; join reuses membership for the same token even if room already started/full. If omitted on create/join the server generates a token, but recovery after a lost first response is not guaranteed.

Private recovery links must put token in URL fragment, never query/path. Remove the fragment with history replacement after import. The room code/name alone never recovers a session. Keep room invitation separate from private recovery link.

## Settings

`title` 1–60 chars; `maxMembers` 2–50; `poolMode` `names|custom|mixed`; `items` 2–100 unique 1–80 character labels in custom/mixed; `removePicked`, `turnBased`, `wheelHidden`, `musicEnabled` booleans; `coverType` color/image; `coverColor` hex; `coverImage` bundled local PNG/JPG/WebP path or data URL up to ~300KB.

`excludeSelf` always true; it cannot be disabled. Name matching uses Unicode NFKC, trim, space collapse, and lowercase. Duplicate member names or custom labels are rejected. Mixed mode unions custom items with member names, prioritizing linked member-name entries and deduplicating matching custom labels.

`participantMode` is `open` by default or `roster`. A roster contains 2–50 unique cleaned names, includes the creator, and sets capacity to its length. A roster room cannot start until every listed name is claimed; concurrent claims are protected by the existing CAS retry. Prelisted identities remain immutable after reset. Per-person code hashes and Google bindings live in the existing room JSON. The separate Google session table requires migration `0002_google_sessions.sql`.

## Response

`{room:{code,phase,generation,settings,ownerId,members:[{id,name,status}],turnMemberId,turnOrder:[memberId]},me:{id,name,isOwner,status,result:null|{id,label}},wheelItems:[{id,label}]}`.
Create/join additionally return `token` both top-level and `me.token`.
Phase lobby/active/complete; status waiting/picking/picked. Only this authenticated member's result is ever serialized. Host gets other participants' statuses, never results.

`turnOrder` publishes only participant IDs in their randomized order. The UI marks `turnMemberId` as ready to spin before their first spin, then picking for the animation window and picked afterward. The turn queue, current-player banner, and completion counter never read other participants' assignments.

The image picker accepts PNG/JPG/WebP files up to 20 MB and resizes them in the browser to a maximum 1024px edge and 280 KB encoded image before sending the settings. The API's existing 410,000-character cover-image limit and 450,000-byte request limit remain in place. Image covers use a shared image clipped separately to every wedge, so the winning wedge can move independently.

Wheel list is the **original stable pool**, not a remaining-item disclosure. Assignments still exclude consumed items internally when removePicked is on. Hidden-wheel responses replace labels with `?`; non-owner custom settings.items are redacted. The owner inherently knows their entered custom list. Own final result remains available after spin.

## Draw behavior

Starting precomputes a cryptographically shuffled feasible full matching. Randomized augmenting paths avoid sequential-draw deadlocks and always find a complete assignment if possible. The algorithm is randomized but does not promise a uniform distribution over all possible constrained matchings.

Spin is idempotent and reveals the reserved assignment. It marks picking for 6 seconds; after that the server derives picked and advances turn automatically, without requiring the browser to finish an animation. All mutations use database CAS and retry against fresh state, protecting simultaneous joins/spins/reset races. Explicit repeat mode allows repeated items across participants, never a self name. Owner participates.

The host can reset a round; results are then discarded and a fresh start rematches everyone. This action cannot disclose previous assignments.

## Security and limits

Private Cloudflare D1 binding: only the Worker and authorized account administrators can access tables; no browser database endpoint. 256-bit session capabilities are hashed before database persistence. All API responses are no-store, and errors omit SQL/secret details. Browser origins are explicitly allowlisted with CORS; mutations are JSON-only and authenticated with bearer capabilities. IP-level and session-level durable rate limits prevent basic brute-force and abuse; Google account identity is verified server-side; no CAPTCHA is used. Anyone with a room code can join before start if capacity remains; a name is a display label, not verified identity.

Rate limits: 1200 API requests/IP/min, 90 state requests/session/min, 45 mutations/session/min, 15 creates/IP/hour. Visible active rooms poll every 5 seconds; lobby/complete rooms poll every 15 seconds. Hidden/offline tabs pause.

## Local QA

`node --test tests/backend.test.mjs` tests matching, privacy, concurrency, replay and reset using an atomic in-memory store.
`npm run dev` starts a local-only API that persists rooms in `.wishwheel/rooms.json`. Set `WISHWHEEL_DATA_DIR` to choose another local data directory; `WISHWHEEL_VOLATILE=1` selects temporary memory for isolated QA. The API prefers 127.0.0.1:3001 and selects a free port if occupied; the launcher passes the actual port to Vite's proxy. This harness is not imported by production. Local writes use an exclusive process lock, fsync, atomic replacement, and revision CAS; corrupt data is never silently replaced with empty storage.

### Long-term recovery

Room records and private capabilities have no application expiry. Browser room entries retain host/guest role and are no longer truncated to twenty. Recovery JSON uses `{format:"wishwheel-recovery",version:1,rooms:[...]}` and contains private capabilities. Import validates all entries before changing browser storage, merges by code, and preserves existing host entries over guest entries. It does not import or recreate server state. Production rooms use private Cloudflare D1; local rooms depend on retaining the `.wishwheel` data directory. Old in-memory-only rooms are not retroactively persisted.

Production verification must additionally inspect the private D1 binding, apply the migrations, exercise actual deployed API across separate sessions, and verify secrets are absent from public assets.

### Optional deterministic browser fixtures

`WISHWHEEL_QA_FIXTURES=1 npm run dev` seeds one temporary local test room `QA2ABC` in the lobby with Daniel QA, Ron QA, and Luna QA. Capacity is three, names-only, removal and turns enabled. Their fake test capability tokens are respectively 43 `A` characters, 43 `B` characters, and 43 `C` characters. The test server prints them. Use the app's documented private-recovery fragment format in separate tabs to exercise identities in one QA browser. This flag is read only by the explicit local test harness; production imports neither fixture nor memory-store code.

## Google accounts and private person codes

`me.accountLinked` identifies a Google-bound place. The host receives invitation metadata; plaintext `inviteCodes` are returned only on creation/issuance/rotation and never persisted. `issue-invites` creates missing codes; `regenerate-invite` needs a slot ID and revokes the old code and guest access while retaining the result and Google binding. Attempts are limited to 60 per IP/room per 10 minutes.

Worker GET `/api/auth/session` supplies a nonce and public client ID. POST `/api/auth/google` verifies a signed Google credential against the nonce, issuer, audience and expiry, then issues a 30-day HttpOnly session cookie whose hash is stored in D1. POST `/api/auth/logout` revokes it. Production frontend auth paths are `/api/wishwheel/auth/*`. JSON account fields are never trusted. See [setup and privacy](GOOGLE-SIGN-IN.md).

## Shared animation events

The public room projection includes `serverNow` and member `spinStartedAt`/`spinEndsAt`, with null values before a spin. No selected item, slice index or landing angle is included. Spectators use generic wheel rotation and sealed-gift effects, and can celebrate spins completed between polling ticks. Every visible active-room member polls at 5 seconds, including members who already picked; other phases retain 15-second polling, and hidden tabs pause. This increases active-room reads and rate-counter writes for finished players compared with the earlier 15-second polling. Free quotas still apply.

The owner's popup is client-only and starts on a fresh successful spin; revisiting a saved result does not replay it. The popup disappears on reset/navigation, and closing vanishes the text before moving a blank card into the hidden result area. Reduced motion skips travel/rotation. See [animation QA](DRAW-EXPERIENCE.md).
