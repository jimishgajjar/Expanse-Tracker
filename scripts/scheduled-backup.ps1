param(
  [string]$Repository = (Split-Path -Parent $PSScriptRoot),
  [string]$Migrations = './drizzle',
  [switch]$Report,
  [string]$VerifyFile,
  [switch]$RecoveryDrill,
  [switch]$ApplyRelease,
  [string]$CompareFile
)
$ErrorActionPreference = 'Stop'
if ($RecoveryDrill -and (-not $VerifyFile -or $ApplyRelease -or $CompareFile -or $Report)) {
  throw 'RecoveryDrill requires VerifyFile and cannot be combined with release, comparison or reporting.'
}
Set-Location -LiteralPath $Repository
if ($RecoveryDrill) {
  & (Join-Path $PSScriptRoot 'protect-recovery-directory.ps1') -Repository (Get-Location).Path
}
$backupState = Join-Path $Repository '.codex/backup-task'
$backupKeyFile = Join-Path $backupState 'key.dpapi'
if (-not (Test-Path -LiteralPath $backupKeyFile)) { throw 'Backup key is missing. Run install-backup-task.ps1 first.' }
$protectedKey = (Get-Content -LiteralPath $backupKeyFile -Raw).Trim() | ConvertTo-SecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protectedKey)
try {
  $env:BACKUP_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $backupArguments = @('--production', '--env=.env.production.backup.local', '--encrypted', "--migrations=$Migrations")
  if ($Report) { $backupArguments += '--report-production' }
  if ($VerifyFile) { $backupArguments += "--verify-encrypted=$VerifyFile" }
  if ($RecoveryDrill) { $backupArguments += '--recovery-drill' }
  if ($CompareFile) { $backupArguments += "--compare-encrypted=$CompareFile" }
  if ($ApplyRelease) {
    if (-not $CompareFile) { throw 'A verified baseline is required.' }
    & node 'node_modules/tsx/dist/cli.mjs' 'scripts/apply-improvements-migration.ts' $CompareFile
  } else {
    & node 'node_modules/tsx/dist/cli.mjs' 'scripts/backup-db.ts' @backupArguments
  }
  if ($LASTEXITCODE -ne 0) { throw 'Backup or restore verification failed. The last successful backup has been retained.' }
} finally {
  Remove-Item Env:BACKUP_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
}
