# EduPay V5.6 — Commercial Master Candidate

V5.6 adalah kandidat master komersial sebelum packaging V6.0. Release ini tidak boleh diberi label siap jual sampai `UAT-V56-COMMERCIAL-MASTER.md` selesai 100%.

## Highlight
- PostgreSQL source of truth + server-first operational flow.
- Unified `/api/v1` security gateway.
- SQL dashboard/reports dan server pagination.
- Admin + Finance shared proof verification.
- Private proof storage.
- Staff/parent notifications.
- WhatsApp reminder.
- Daily full backup (database + proof + branding).
- Configurable retention.
- Isolated restore rehearsal.
- Upload logo sekolah controlled storage.
- Dynamic application/school branding.
- Official printable receipt.
- Configurable receipt prefix/footer.
- Commercial Readiness panel.
- Fresh schema synchronized for Commercial Master.

## Backup layout
`/var/backups/edupay/daily/YYYYMMDD-HHMMSS/`
- `database.sql.gz`
- `proofs.tar.gz`
- `branding.tar.gz`
- `manifest.sha256`
- `metadata.json`

Maintenance status:
- `/var/lib/edupay/maintenance/backup-status.json`
- `/var/lib/edupay/maintenance/restore-status.json`

## Scheduling
Systemd timer: `edupay-backup.timer`
Default schedule: sekitar 02:15 setiap hari dengan randomized delay hingga 10 menit.

## Manual operations
Backup sekarang:
```bash
sudo /var/www/edupay/deploy/backup-edupay.sh
```

Restore verification terbaru:
```bash
sudo /var/www/edupay/deploy/verify-restore.sh
```

Lihat timer:
```bash
systemctl list-timers edupay-backup.timer
```

Lihat log backup systemd:
```bash
journalctl -u edupay-backup.service --no-pager -n 100
```

## Upgrade
```bash
cd /var/www/edupay
git fetch origin main
git reset --hard origin/main
chmod +x deploy/upgrade-v56.sh
sudo ./deploy/upgrade-v56.sh
```

Buka setelah sukses:
`https://edupay.rumahsoftware.site/?v=56`

## Status komersial
**Candidate only until UAT PASS.** Setelah UAT V5.6 selesai, fase berikutnya adalah V6.0 Release Packaging: installer/onboarding baru, release tag, rollback package, legal template, dan production sign-off.
