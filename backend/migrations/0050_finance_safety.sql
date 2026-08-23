BEGIN;

CREATE TABLE IF NOT EXISTS receipt_counters (
  school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  counter_date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, counter_date)
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_bill_active
  ON payments(bill_id, voided, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_school_paid
  ON payments(school_id, paid_at DESC);

COMMIT;
