BEGIN;

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

UPDATE schools
SET support_email = COALESCE(NULLIF(support_email,''), 'rumahsoftwarenetwork551@gmail.com'),
    app_name = COALESCE(NULLIF(app_name,''), 'EduPay')
WHERE TRUE;

CREATE INDEX IF NOT EXISTS idx_students_school_active_name ON students(school_id,active,name);
CREATE INDEX IF NOT EXISTS idx_classes_school_active_name ON classes(school_id,active,name);
CREATE INDEX IF NOT EXISTS idx_fee_types_school_active_name ON fee_types(school_id,active,name);
CREATE INDEX IF NOT EXISTS idx_bills_school_status_due ON bills(school_id,status,due_date);
CREATE INDEX IF NOT EXISTS idx_payments_school_paid_at ON payments(school_id,paid_at DESC);

COMMIT;
