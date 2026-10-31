-- Private D1 binding only; no public database API or credentials.
CREATE TABLE IF NOT EXISTS keep_alive (
  id INTEGER PRIMARY KEY,
  last_updated TEXT
);

INSERT INTO keep_alive (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
