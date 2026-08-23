BEGIN;

CREATE TABLE IF NOT EXISTS schools (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  npsn VARCHAR(30) NULL,
  address TEXT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(180) NULL,
  principal_name VARCHAR(160) NULL,
  treasurer_name VARCHAR(160) NULL,
  bank_name VARCHAR(100) NULL,
  bank_account VARCHAR(100) NULL,
  bank_account_name VARCHAR(160) NULL,
  qris_info TEXT NULL,
  academic_year_current VARCHAR(20) NULL,
  semester_current VARCHAR(20) NULL,
  support_email VARCHAR(180) NULL,
  app_name VARCHAR(100) NULL DEFAULT 'EduPay',
  logo_url TEXT NULL,
  logo_storage_key VARCHAR(255) NULL,
  logo_mime VARCHAR(100) NULL,
  logo_updated_at TIMESTAMPTZ NULL,
  receipt_prefix VARCHAR(16) NOT NULL DEFAULT 'PAY' CHECK (receipt_prefix ~ '^[A-Z0-9-]{2,16}$'),
  receipt_footer TEXT NULL,
  backup_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (backup_retention_days BETWEEN 7 AND 365),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_hash TEXT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','finance','parent')),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','not_invited','invited','disabled')),
  salutation VARCHAR(10) NULL CHECK (salutation IS NULL OR salutation IN ('Bapak','Ibu')),
  nickname VARCHAR(80) NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  activated_at TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, username)
);

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
CREATE UNIQUE INDEX IF NOT EXISTS uq_homeroom_teacher_nip ON homeroom_teachers(school_id,nip) WHERE nip IS NOT NULL AND nip<>'';

CREATE TABLE IF NOT EXISTS classes (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  name VARCHAR(120) NOT NULL,
  level VARCHAR(30) NULL,
  academic_year VARCHAR(20) NULL,
  homeroom_teacher_id BIGINT NULL REFERENCES homeroom_teachers(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name, academic_year)
);
CREATE INDEX IF NOT EXISTS idx_classes_homeroom_teacher ON classes(school_id,homeroom_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_active_name ON classes(school_id,active,name);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  nis VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  class_id BIGINT NULL REFERENCES classes(id) ON DELETE SET NULL,
  guardian_name VARCHAR(150) NULL,
  guardian_phone VARCHAR(40) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, nis)
);
CREATE INDEX IF NOT EXISTS idx_students_school_active_name ON students(school_id,active,name);

CREATE TABLE IF NOT EXISTS guardian_students (
  guardian_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guardian_user_id, student_id)
);

CREATE TABLE IF NOT EXISTS fee_types (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  name VARCHAR(150) NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  period VARCHAR(50) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);
CREATE INDEX IF NOT EXISTS idx_fee_types_school_active_name ON fee_types(school_id,active,name);

CREATE TABLE IF NOT EXISTS bills (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  due_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','pending','paid','cancelled')),
  payment_method VARCHAR(50) NULL,
  proof_name VARCHAR(255) NULL,
  proof_storage_key VARCHAR(255) NULL,
  proof_mime VARCHAR(100) NULL,
  proof_size BIGINT NULL,
  proof_uploaded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_bills_student_updated ON bills(student_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_school_status_due ON bills(school_id,status,due_date);
CREATE INDEX IF NOT EXISTS idx_bills_pending_proof ON bills(school_id,status,updated_at) WHERE status='pending';

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  receipt VARCHAR(100) NOT NULL,
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at TIMESTAMPTZ NULL,
  void_reason TEXT NULL,
  voided_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, receipt),
  UNIQUE (school_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_payments_bill_active ON payments(bill_id,voided,paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_school_paid ON payments(school_id,paid_at DESC);

CREATE TABLE IF NOT EXISTS receipt_counters (
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  counter_date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id,counter_date)
);

CREATE TABLE IF NOT EXISTS activation_tokens (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activation_user_active ON activation_tokens(user_id,used_at,expires_at);

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
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id,read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NULL REFERENCES schools(id) ON DELETE SET NULL,
  user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(100) NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION edupay_notify_staff_on_pending() RETURNS trigger AS $$
BEGIN
  IF NEW.status='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    INSERT INTO notifications(school_id,user_id,student_id,type,title,message,entity_type,entity_id)
    SELECT NEW.school_id,u.id,NEW.student_id,'proof_pending','Bukti transfer baru','Bukti pembayaran '||NEW.title||' menunggu verifikasi.','bill',NEW.id::text
    FROM users u WHERE u.school_id=NEW.school_id AND u.role IN ('admin','finance') AND u.status='active';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_edupay_notify_staff_on_pending ON bills;
CREATE TRIGGER trg_edupay_notify_staff_on_pending AFTER INSERT OR UPDATE OF status ON bills FOR EACH ROW EXECUTE FUNCTION edupay_notify_staff_on_pending();

COMMIT;
