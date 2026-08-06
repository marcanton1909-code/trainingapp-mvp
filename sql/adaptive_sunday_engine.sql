-- TrainingApp Adaptive Sunday Engine V1
-- Ejecutar una sola vez en D1 remoto.

CREATE TABLE IF NOT EXISTS adaptive_week_adjustments (
  id TEXT PRIMARY KEY,
  training_plan_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_week_number INTEGER NOT NULL,
  target_week_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  action TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  volume_factor REAL NOT NULL,
  pace_delta_seconds INTEGER NOT NULL DEFAULT 0,
  completion_rate REAL,
  distance_completion_rate REAL,
  planned_distance_km REAL,
  actual_distance_km REAL,
  average_pace_seconds_per_km REAL,
  average_effort_score REAL,
  fatigue_score INTEGER,
  soreness_score INTEGER,
  sleep_quality_score INTEGER,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'rules-v1',
  scheduled_for TEXT,
  applied_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(training_plan_id, target_week_number)
);

CREATE INDEX IF NOT EXISTS idx_adaptive_adjustments_user
ON adaptive_week_adjustments(user_id, applied_at);

CREATE INDEX IF NOT EXISTS idx_adaptive_adjustments_plan_week
ON adaptive_week_adjustments(training_plan_id, target_week_number);

CREATE TABLE IF NOT EXISTS adaptive_engine_runs (
  id TEXT PRIMARY KEY,
  scheduled_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  plans_seen INTEGER NOT NULL DEFAULT 0,
  applied_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_adaptive_engine_runs_scheduled
ON adaptive_engine_runs(scheduled_at);
