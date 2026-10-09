CREATE TABLE IF NOT EXISTS oauth_connections (
  account_uuid uuid PRIMARY KEY,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  scopes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumed_events (
  event_hash text PRIMARY KEY,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS consumed_events_expires_at_idx ON consumed_events (expires_at);
CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON oauth_states (expires_at);
