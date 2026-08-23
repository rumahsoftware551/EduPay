BEGIN;

CREATE OR REPLACE FUNCTION edupay_notify_staff_on_pending()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    INSERT INTO notifications(
      school_id,user_id,student_id,type,title,message,entity_type,entity_id
    )
    SELECT
      NEW.school_id,
      u.id,
      NEW.student_id,
      'proof_pending',
      'Bukti transfer baru',
      'Bukti pembayaran ' || NEW.title || ' menunggu verifikasi.',
      'bill',
      NEW.id::text
    FROM users u
    WHERE u.school_id = NEW.school_id
      AND u.role IN ('admin','finance')
      AND u.status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_edupay_notify_staff_on_pending ON bills;
CREATE TRIGGER trg_edupay_notify_staff_on_pending
AFTER INSERT OR UPDATE OF status ON bills
FOR EACH ROW
EXECUTE FUNCTION edupay_notify_staff_on_pending();

-- Backfill pending proofs that existed before V5.2 so the bell is useful immediately.
INSERT INTO notifications(
  school_id,user_id,student_id,type,title,message,entity_type,entity_id
)
SELECT
  b.school_id,
  u.id,
  b.student_id,
  'proof_pending',
  'Bukti transfer menunggu verifikasi',
  'Bukti pembayaran ' || b.title || ' menunggu verifikasi.',
  'bill',
  b.id::text
FROM bills b
JOIN users u
  ON u.school_id=b.school_id
 AND u.role IN ('admin','finance')
 AND u.status='active'
WHERE b.status='pending'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id=u.id
      AND n.type='proof_pending'
      AND n.entity_type='bill'
      AND n.entity_id=b.id::text
  );

COMMIT;
