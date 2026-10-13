param([switch]$KeyOnly)
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$state = Join-Path $repository '.codex/backup-task'
New-Item -ItemType Directory -Path $state -Force | Out-Null
$keyFile = Join-Path $state 'key.dpapi'
if (-not (Test-Path -LiteralPath $keyFile)) {
  $bytes = New-Object byte[] 32
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  $generator.GetBytes($bytes)
  $generator.Dispose()
  $key = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
  $key | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $keyFile
  [Array]::Clear($bytes, 0, $bytes.Length)
  $key = $null
}
if ($KeyOnly) { Write-Output 'Windows-user-protected backup key ready.'; exit 0 }
$shell = (Get-Command pwsh).Source
$script = Join-Path $repository 'scripts/scheduled-backup.ps1'
$action = New-ScheduledTaskAction -Execute $shell -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$script`" -Report" -WorkingDirectory $repository
$trigger = New-ScheduledTaskTrigger -Daily -At '20:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Expense Tracker verified backup' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Encrypted database backup with isolated restore verification. Requires this Windows user to be signed in.' -Force | Select-Object TaskName, State
