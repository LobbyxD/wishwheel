CREATE TABLE IF NOT EXISTS wishwheel_google_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  account TEXT NOT NULL CHECK(json_valid(account)),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wishwheel_google_sessions_expiry ON wishwheel_google_sessions(expires_at);
