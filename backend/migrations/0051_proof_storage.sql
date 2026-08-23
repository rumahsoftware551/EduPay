BEGIN;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_storage_key VARCHAR(255) NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_mime VARCHAR(100) NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_size BIGINT NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_bills_pending_proof ON bills(school_id,status,updated_at) WHERE status='pending';
COMMIT;
