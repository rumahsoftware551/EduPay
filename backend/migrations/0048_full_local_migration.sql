BEGIN;

CREATE TABLE IF NOT EXISTS data_migration_runs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(60) NOT NULL DEFAULT 'browser-localstorage',
  source_fingerprint VARCHAR(128) NULL,
  classes_count INTEGER NOT NULL DEFAULT 0,
  homerooms_count INTEGER NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  fee_types_count INTEGER NOT NULL DEFAULT 0,
  bills_count INTEGER NOT NULL DEFAULT 0,
  payments_count INTEGER NOT NULL DEFAULT 0,
  guardians_count INTEGER NOT NULL DEFAULT 0,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_migration_runs_school_created
  ON data_migration_runs(school_id, created_at DESC);

COMMIT;
