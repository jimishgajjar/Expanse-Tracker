# Verified local backups

Windows Task Scheduler task: `Expense Tracker verified backup`. On November 5, 2026, the installed trigger ran at **7:00 pm Toronto time** (boundary `2026-10-13T19:00:00-05:00`); its last run succeeded. The installer requests 8:00 pm, so inspect the actual next run after installation or a daylight-saving change. Requires this Windows user to be signed in and the computer available; missed runs catch up when available. Failures retry three times, ten minutes apart. Check Settings > Verified backups and Task Scheduler > Last Run Result (0 means success). No email or push notifications are sent.

## Files and encryption

- `backups/encrypted/backup-*.etb`: AES-256-GCM encrypted, compressed database snapshots including the schema migrations needed to restore them.
- `backups/encrypted/status.json`: last successful isolated restore verification.
- `.codex/backup-task/key.dpapi`: encryption key protected by Windows DPAPI for the current Windows account. This is not a portable recovery key.
- `.env.production.backup.local`: existing production connection; ignored by Git, never include in screenshots or support messages.

Every scheduled run reads production in a repeatable-read, read-only transaction, writes ciphertext, reads it back, decrypts it, restores it into an isolated in-memory database, and compares rows. Only verified success updates the app's backup-status metadata. No financial records are written by the backup job. Backups are retained; monitor disk space.

**Recovery limitation:** losing this computer or its Windows profile can lose both the backups and access to the key. Keep a separate protected recovery copy using an offline password manager or independent encrypted storage. Copying `key.dpapi` alone to a different Windows profile will not unlock it. Never put the raw key in Git or chat.

## Prepare a portable recovery key

Run this yourself in a local PowerShell 7 terminal while the original Windows profile is available:

```powershell
pwsh -NoProfile -File scripts/recovery-key.ps1 -Export -OutputFile 'F:\Code\Expanse-Tracker\backups\recovery-key.etrk'
```

The masked prompt asks for a recovery passphrase of at least 16 characters and confirmation. Use a long, randomly generated passphrase stored in your password manager. Never put it in command arguments, chat, environment files or Git. The tool wraps the **existing** backup key, writes a new authenticated encrypted `.etrk` file, reads it back and verifies it. It refuses an existing output file and does not rotate the scheduled job's key or change any archive. Passphrase/key input travels to the child process over stdin; it is not printed. Managed runtimes cannot guarantee erasure of every temporary string from process memory.

Copy the `.etrk` file and a recent `.etb` archive to independent storage; keep the passphrase separately. Both ciphertext files are needed, as well as the passphrase. `.etrk` files are ignored by Git, but that is not an independent backup. If you lose the passphrase, the portable copy cannot be unlocked. Keep the old Windows key and existing backups until a separate recovery succeeds.

On a replacement computer with Node, PowerShell 7, this source checkout and its locked dependencies installed, use:

```powershell
pwsh -NoProfile -File scripts/recovery-key.ps1 -Restore -RecoveryKeyFile 'D:\Recovery\recovery-key.etrk' -VerifyFile 'D:\Recovery\backup-TIMESTAMP.etb'
```

This prompts locally, unlocks the portable key without DPAPI, and restores only to a new isolated drill directory under this checkout. It checks the archived schema, all rows, balances and disk reopen. The wrapper protects that directory before writing private data. It never switches an app connection or overwrites an existing database. Use `receipt.json` to record the replacement machine/OS and app/auth/access checks separately; a database receipt alone does not prove a complete application recovery.

The envelope uses a random salt, fixed scrypt parameters (`N=131072`, `r=8`, `p=1`) and AES-256-GCM with authenticated version context. Its fixed 80-byte layout rejects malformed files and prevents files from choosing arbitrary derivation cost. References: [Node crypto](https://nodejs.org/api/crypto.html) and [OWASP scrypt guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).

**Evidence boundary:** the synthetic export, fresh-process restore and secure-prompt wrapper are exercised by `npm run rehearse:recovery`. No real portable key was exported during implementation, and no independently stored copy or replacement-machine test has been confirmed. The current live archive still depends on the original profile until you complete these steps.

## Rehearse recovery without touching production

From the repository, in PowerShell:

```powershell
pwsh -NoProfile -File scripts/scheduled-backup.ps1 -VerifyFile 'F:\Code\Expanse-Tracker\backups\encrypted\backup-TIMESTAMP.etb'
```

This decrypts the selected file, reconstructs its migration schema and restores into memory. A successful command verifies recoverability; it does not replace production.

For a timed restore to a **new database on disk**, use the same command with `-RecoveryDrill`:

```powershell
pwsh -NoProfile -File scripts/scheduled-backup.ps1 -VerifyFile 'F:\Code\Expanse-Tracker\backups\encrypted\backup-TIMESTAMP.etb' -RecoveryDrill
```

This mode does not load production credentials or connect to the source. It restores the archived schema into a newly created `backups/recovery-drills/restore-*/database`, compares every original row, closes and reopens the database, and repeats the row and balance checks. It never accepts an existing database destination. The PowerShell wrapper restricts directory access to the current Windows user and SYSTEM before restoring. Recovered files contain plaintext financial and authentication data: keep them private, never upload or commit them, and remove the specific drill directory when no longer needed. The encrypted original is retained.

The adjacent `receipt.json` records archive SHA-256, snapshot age, duration, row counts, balance fingerprint and reopen verification. A snapshot under 24 hours and a restore under four hours meet the **local drill targets only**. They do not prove recovery after computer/profile loss, application cutover, or reconciliation of newer writes. No production connection is switched automatically.

Run `npm run rehearse:recovery` for synthetic regression checks, including exact money recovery, preserved earlier destinations, wrong-key/tamper rejection, and refusal to run a drill without an archive. The November 5 drill and remaining acceptance gates are recorded in [M14 mobile and recovery evidence](docs/m14-mobile-recovery.md).

## Actual recovery procedure

Stop application writes, take a fresh copy of the current database, and restore the chosen snapshot into a NEW database. Verify table counts, relationships, ledger balances, authentication and workspace access there. Reconcile records created after the snapshot before switching the app connection. Never restore an older snapshot over live data automatically. The Excel export is for portability and review, not complete database recovery.

## Install or inspect the scheduled task

```powershell
pwsh -NoProfile -File scripts/install-backup-task.ps1
Get-ScheduledTaskInfo -TaskName 'Expense Tracker verified backup'
```

Installing reuses the existing protected key; do not delete it. The job depends on this repository, its dependencies, the ignored production environment file, and this Windows account remaining available.
