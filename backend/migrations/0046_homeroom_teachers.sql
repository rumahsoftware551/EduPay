BEGIN;

CREATE TABLE IF NOT EXISTS homeroom_teachers (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  nip VARCHAR(100) NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(180) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, external_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_homeroom_teacher_nip
  ON homeroom_teachers(school_id, nip)
  WHERE nip IS NOT NULL AND nip <> '';

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS homeroom_teacher_id BIGINT NULL REFERENCES homeroom_teachers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_homeroom_teacher
  ON classes(school_id, homeroom_teacher_id);

COMMIT;
