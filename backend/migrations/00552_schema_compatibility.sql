BEGIN;

-- Ensure columns required by current Admin / Finance / Parent runtime exist
-- even when an installation skipped one of the incremental upgrades.
ALTER TABLE users ADD COLUMN IF NOT EXISTS salutation VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(80) NULL;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_name VARCHAR(255) NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_storage_key VARCHAR(255) NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_mime VARCHAR(100) NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_size BIGINT NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ NULL;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS npsn VARCHAR(30) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email VARCHAR(180) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS principal_name VARCHAR(160) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS treasurer_name VARCHAR(160) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(160) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS qris_info TEXT NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_year_current VARCHAR(20) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS semester_current VARCHAR(20) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS support_email VARCHAR(180) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS app_name VARCHAR(100) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;

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

CREATE INDEX IF NOT EXISTS idx_payments_bill_active ON payments(bill_id,voided,paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_school_paid ON payments(school_id,paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id,read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bills_pending_proof ON bills(school_id,status,updated_at) WHERE status='pending';

UPDATE schools
SET support_email=COALESCE(NULLIF(support_email,''),'rumahsoftwarenetwork551@gmail.com'),
    app_name=COALESCE(NULLIF(app_name,''),'EduPay');

UPDATE users
SET nickname=split_part(trim(name),' ',1)
WHERE role='parent' AND (nickname IS NULL OR trim(nickname)='');

COMMIT;
