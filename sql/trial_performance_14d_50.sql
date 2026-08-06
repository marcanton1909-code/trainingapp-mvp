PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trial_campaigns (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  max_trials INTEGER NOT NULL,
  trials_started INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_trials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','expired','converted','revoked')),
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  converted_at TEXT,
  expired_at TEXT,
  device_hash TEXT NOT NULL,
  signup_ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(campaign_id) REFERENCES trial_campaigns(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_trials_device_unique
ON user_trials(device_hash);

CREATE INDEX IF NOT EXISTS idx_user_trials_ip
ON user_trials(signup_ip_hash);

CREATE INDEX IF NOT EXISTS idx_user_trials_status
ON user_trials(status, expires_at);

INSERT INTO trial_campaigns (
  id, campaign_code, name, plan_code, duration_days, max_trials,
  trials_started, starts_at, ends_at, is_active, created_at, updated_at
)
VALUES (
  lower(hex(randomblob(16))),
  'performance_trial_14d_50',
  'Prueba Performance 14 días - 50 cupos',
  'performance',
  14,
  50,
  0,
  datetime('now'),
  NULL,
  1,
  datetime('now'),
  datetime('now')
)
ON CONFLICT(campaign_code) DO UPDATE SET
  name = excluded.name,
  plan_code = 'performance',
  duration_days = 14,
  max_trials = 50,
  is_active = 1,
  updated_at = datetime('now');
