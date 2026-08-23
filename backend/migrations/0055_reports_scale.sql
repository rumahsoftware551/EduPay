BEGIN;

-- Student/master list access patterns.
CREATE INDEX IF NOT EXISTS idx_students_school_active_name
  ON students(school_id, active DESC, name, id);
CREATE INDEX IF NOT EXISTS idx_students_school_class_active_name
  ON students(school_id, class_id, active DESC, name, id);
CREATE INDEX IF NOT EXISTS idx_students_school_guardian_phone
  ON students(school_id, guardian_phone) WHERE guardian_phone IS NOT NULL AND guardian_phone <> '';
CREATE INDEX IF NOT EXISTS idx_guardian_students_student
  ON guardian_students(student_id, guardian_user_id);

-- Parent account list/search access patterns.
CREATE INDEX IF NOT EXISTS idx_users_school_role_status_name
  ON users(school_id, role, status, name, id);

-- Billing queue, ageing, reporting and class drill-down.
CREATE INDEX IF NOT EXISTS idx_bills_school_status_due_id
  ON bills(school_id, status, due_date, id DESC);
CREATE INDEX IF NOT EXISTS idx_bills_school_student_status_id
  ON bills(school_id, student_id, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_bills_school_created_id
  ON bills(school_id, created_at DESC, id DESC);

-- Payment ledger and date/method reporting.
CREATE INDEX IF NOT EXISTS idx_payments_school_voided_paid_id
  ON payments(school_id, voided, paid_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_payments_school_method_paid_id
  ON payments(school_id, method, paid_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_payments_student_paid_id
  ON payments(student_id, paid_at DESC, id DESC);

-- Small master dropdowns.
CREATE INDEX IF NOT EXISTS idx_classes_school_active_name
  ON classes(school_id, active DESC, name, id);

ANALYZE students;
ANALYZE users;
ANALYZE guardian_students;
ANALYZE bills;
ANALYZE payments;
ANALYZE classes;

COMMIT;
