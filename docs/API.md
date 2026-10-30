# Wishwheel API and deployment

## Deployment configuration

- Vite React frontend, Vercel Node serverless route `api/room.js`.
- Apply `db/bootstrap.sql` only to the explicitly approved Supabase project.
- Server-only environment: `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (preferred modern sb_secret key); legacy `SUPABASE_SERVICE_ROLE_KEY` is an optional fallback.
- Never prefix that key with `VITE_`, return it from the API, or put it in source.
- No Supabase browser client, no public table read, no anonymous auth setup needed.
- New or persistent secret-key configuration requires the user's action-time approval.
- Vercel must route `/api/*` to its functions and all other paths to `index.html`.

## Requests

POST `/api/room` JSON `{action,code?,name?,settings?,generation?}` with `Authorization: Bearer <token>`.
GET `/api/room?code=ABC234` is also supported for state.
Actions: `create`, `join`, `state`, `start`, `spin`, `reset`, `preview`, `identify`, `kick`.
Create needs name/settings; join needs code/name. All existing-room actions need code.
Start/spin/reset require current integer generation. Reset increments generation and returns lobby, retaining membership.

`preview` accepts only the invitation code and requires no token. It returns `{code,title,phase,participantMode,memberCount,maxMembers,people:[{name,claimed}]}`. Roster choices are returned only in the lobby; no member IDs, tokens, assignments or results are exposed. Private `state` still requires the participant capability.

`identify` requires `name`, current `generation`, and the participant token; changes are allowed only in the lobby and must select a free listed name in roster mode. `kick` requires `memberId`, current `generation`, and the owner token. The host cannot kick themselves. Removal revokes the old capability, frees a roster claim, increments generation, clears assignments/results and returns the room to the lobby. The UI confirms the effect before sending the request. An invitation code still permits a new session to join an open place; names are not verified real-world identities.

Generate a pending token with browser crypto before create/join: 32 random bytes encoded base64url (43 chars). Save it before request; it makes uncertain-response retries safe. Create reuses existing room for the same owner token; join reuses membership for the same token even if room already started/full. If omitted on create/join the server generates a token, but recovery after a lost first response is not guaranteed.

Private recovery links must put token in URL fragment, never query/path. Remove the fragment with history replacement after import. The room code/name alone never recovers a session. Keep room invitation separate from private recovery link.

## Settings

`title` 1–60 chars; `maxMembers` 2–50; `poolMode` `names|custom|mixed`; `items` 2–100 unique 1–80 character labels in custom/mixed; `removePicked`, `turnBased`, `wheelHidden`, `musicEnabled` booleans; `coverType` color/image; `coverColor` hex; `coverImage` bundled local PNG/JPG/WebP path or data URL up to ~300KB.

`excludeSelf` always true; it cannot be disabled. Name matching uses Unicode NFKC, trim, space collapse, and lowercase. Duplicate member names or custom labels are rejected. Mixed mode unions custom items with member names, prioritizing linked member-name entries and deduplicating matching custom labels.

`participantMode` is `open` by default or `roster`. A roster contains 2–50 unique cleaned names, includes the creator, and sets capacity to its length. A roster room cannot start until every listed name is claimed; concurrent claims are protected by the existing CAS retry. Identities are immutable during active/complete rounds and become editable after reset. These fields are stored in the existing JSONB state; no schema migration is needed.

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

Postgres RLS on both tables; no anon/authenticated access; service-only SECURITY INVOKER RPCs. 256-bit session capabilities are hashed before database persistence. All API responses are no-store, and errors omit SQL/secret details. Mutations are same-origin and JSON-only. IP-level and session-level durable rate limits prevent basic brute-force and abuse; no CAPTCHA or external identity verification is claimed. Anyone with a room code can join before start if capacity remains; a name is a display label, not verified identity.

Rate limits: 1200 API requests/IP/min, 90 state requests/session/min, 45 mutations/session/min, 15 creates/IP/hour. Active-room polling starts at 1.5 seconds and scales to 3 seconds for a 50-person room to leave headroom for mutations on shared Wi-Fi. Other phases poll at least every 2.5 seconds.

## Local QA

`node --test tests/backend.test.mjs` tests matching, privacy, concurrency, replay and reset using an atomic in-memory store.
`npm run dev` starts a local-only API that persists rooms in `.wishwheel/rooms.json`. Set `WISHWHEEL_DATA_DIR` to choose another local data directory; `WISHWHEEL_VOLATILE=1` selects temporary memory for isolated QA. The API prefers 127.0.0.1:3001 and selects a free port if occupied; the launcher passes the actual port to Vite's proxy. This harness is not imported by production. Local writes use an exclusive process lock, fsync, atomic replacement, and revision CAS; corrupt data is never silently replaced with empty storage.

### Long-term recovery

Room records and private capabilities have no application expiry. Browser room entries retain host/guest role and are no longer truncated to twenty. Recovery JSON uses `{format:"wishwheel-recovery",version:1,rooms:[...]}` and contains private capabilities. Import validates all entries before changing browser storage, merges by code, and preserves existing host entries over guest entries. It does not import or recreate server state. Production rooms continue to use Supabase; local rooms depend on retaining the `.wishwheel` data directory. Old in-memory-only rooms are not retroactively persisted.

Production verification must additionally inspect SQL permissions/RLS, apply the schema, exercise actual deployed API across separate sessions, and verify secrets are absent from public assets.

### Optional deterministic browser fixtures

`WISHWHEEL_QA_FIXTURES=1 npm run dev` seeds one temporary local test room `QA2ABC` in the lobby with Daniel QA, Ron QA, and Luna QA. Capacity is three, names-only, removal and turns enabled. Their fake test capability tokens are respectively 43 `A` characters, 43 `B` characters, and 43 `C` characters. The test server prints them. Use the app's documented private-recovery fragment format in separate tabs to exercise identities in one QA browser. This flag is read only by the explicit local test harness; production imports neither fixture nor memory-store code.
