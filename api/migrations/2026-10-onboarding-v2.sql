-- trAIning Onboarding V2 - safe additive migration; no existing tables modified.
-- Run ONCE against Cloudflare D1 before deploying backend.
CREATE TABLE IF NOT EXISTS athlete_onboarding_context (
  user_id TEXT PRIMARY KEY NOT NULL,
  context_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_athlete_onboarding_context_updated
  ON athlete_onboarding_context(updated_at);
