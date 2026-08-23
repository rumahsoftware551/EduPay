BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS salutation VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(80) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_salutation_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_salutation_check
      CHECK (salutation IS NULL OR salutation IN ('Bapak','Ibu'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id BIGINT NULL REFERENCES students(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL DEFAULT 'info',
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(60) NULL,
  entity_id VARCHAR(100) NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bills_student_updated
  ON bills(student_id, updated_at DESC);

UPDATE users
SET nickname = split_part(trim(name), ' ', 1)
WHERE role='parent' AND (nickname IS NULL OR trim(nickname)='');

COMMIT;
