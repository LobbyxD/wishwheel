-- Private binding only: the browser never receives D1 credentials or raw rows.
CREATE TABLE IF NOT EXISTS wishwheel_rooms (
  code TEXT PRIMARY KEY NOT NULL,
  owner_hash TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK(json_valid(state)),
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS wishwheel_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wishwheel_limits_expiry ON wishwheel_limits(expires_at);
