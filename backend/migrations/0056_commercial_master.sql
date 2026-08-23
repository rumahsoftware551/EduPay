BEGIN;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS receipt_prefix VARCHAR(16) NOT NULL DEFAULT 'PAY';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS receipt_footer TEXT NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_storage_key VARCHAR(255) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_mime VARCHAR(100) NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ NULL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS backup_retention_days INTEGER NOT NULL DEFAULT 30;

UPDATE schools
SET receipt_prefix = COALESCE(NULLIF(UPPER(regexp_replace(receipt_prefix,'[^A-Z0-9-]','','g')),''),'PAY'),
    backup_retention_days = CASE WHEN backup_retention_days BETWEEN 7 AND 365 THEN backup_retention_days ELSE 30 END;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='schools_receipt_prefix_check') THEN
    ALTER TABLE schools ADD CONSTRAINT schools_receipt_prefix_check
      CHECK (receipt_prefix ~ '^[A-Z0-9-]{2,16}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='schools_backup_retention_check') THEN
    ALTER TABLE schools ADD CONSTRAINT schools_backup_retention_check
      CHECK (backup_retention_days BETWEEN 7 AND 365);
  END IF;
END $$;

COMMIT;
