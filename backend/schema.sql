BEGIN;

CREATE TABLE IF NOT EXISTS schools (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
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
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  activated_at TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, username)
);

CREATE TABLE IF NOT EXISTS classes (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NULL,
  name VARCHAR(120) NOT NULL,
  level VARCHAR(30) NULL,
  academic_year VARCHAR(20) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name, academic_year)
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, external_id)
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, receipt),
  UNIQUE (school_id, external_id)
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
CREATE INDEX IF NOT EXISTS idx_activation_user_active ON activation_tokens(user_id, used_at, expires_at);

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

COMMIT;
