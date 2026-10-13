# Verified local backups

Daily at 8:00 pm in this computer's time zone (currently Toronto). Windows Task Scheduler task: `Expense Tracker verified backup`. Requires this Windows user to be signed in and the computer available; missed runs catch up when available. Failures retry three times, ten minutes apart. Check Settings > Verified backups and Task Scheduler > Last Run Result (0 means success). No email or push notifications are sent.

## Files and encryption

- `backups/encrypted/backup-*.etb`: AES-256-GCM encrypted, compressed database snapshots including the schema migrations needed to restore them.
- `backups/encrypted/status.json`: last successful isolated restore verification.
- `.codex/backup-task/key.dpapi`: encryption key protected by Windows DPAPI for the current Windows account. This is not a portable recovery key.
- `.env.production.backup.local`: existing production connection; ignored by Git, never include in screenshots or support messages.

Every scheduled run reads production in a repeatable-read, read-only transaction, writes ciphertext, reads it back, decrypts it, restores it into an isolated in-memory database, and compares rows. Only verified success updates the app's backup-status metadata. No financial records are written by the backup job. Backups are retained; monitor disk space.

**Recovery limitation:** losing this computer or its Windows profile can lose both the backups and access to the key. Keep a separate protected recovery copy using an offline password manager or independent encrypted storage. Copying `key.dpapi` alone to a different Windows profile will not unlock it. Never put the raw key in Git or chat.

## Rehearse recovery without touching production

From the repository, in PowerShell:

```powershell
pwsh -NoProfile -File scripts/scheduled-backup.ps1 -VerifyFile 'F:\Code\Expanse-Tracker\backups\encrypted\backup-TIMESTAMP.etb'
```

This decrypts the selected file, reconstructs its migration schema and restores into memory. A successful command verifies recoverability; it does not replace production.

## Actual recovery procedure

Stop application writes, take a fresh copy of the current database, and restore the chosen snapshot into a NEW database. Verify table counts, relationships, ledger balances, authentication and workspace access there. Reconcile records created after the snapshot before switching the app connection. Never restore an older snapshot over live data automatically. The Excel export is for portability and review, not complete database recovery.

## Install or inspect the scheduled task

```powershell
pwsh -NoProfile -File scripts/install-backup-task.ps1
Get-ScheduledTaskInfo -TaskName 'Expense Tracker verified backup'
```

Installing reuses the existing protected key; do not delete it. The job depends on this repository, its dependencies, the ignored production environment file, and this Windows account remaining available.
