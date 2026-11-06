#requires -Version 7.0
[CmdletBinding(DefaultParameterSetName='Export')]
param(
  [string]$Repository=(Split-Path -Parent $PSScriptRoot),
  [Parameter(Mandatory,ParameterSetName='Export')][switch]$Export,
  [Parameter(Mandatory,ParameterSetName='Export')][string]$OutputFile,
  [Parameter(Mandatory,ParameterSetName='Restore')][switch]$Restore,
  [Parameter(Mandatory,ParameterSetName='Restore')][string]$RecoveryKeyFile,
  [Parameter(Mandatory,ParameterSetName='Restore')][string]$VerifyFile
)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $Repository
$typescriptRunner=Join-Path $PSScriptRoot '../node_modules/tsx/dist/cli.mjs'
$keyPointer=[IntPtr]::Zero; $phrasePointer=[IntPtr]::Zero; $confirmPointer=[IntPtr]::Zero
$protectedKey=$null; $phrase=$null; $confirm=$null; $secretInput=$null
try{
  if($Export){
    if(-not $IsWindows){throw 'Export requires the original Windows profile. Restore does not.'}
    if((Test-Path -LiteralPath $OutputFile) -or -not $OutputFile.EndsWith('.etrk')){throw 'Choose a new .etrk file; existing recovery keys are never replaced.'}
    $protectedKey=(Get-Content -LiteralPath (Join-Path $Repository '.codex/backup-task/key.dpapi') -Raw).Trim() | ConvertTo-SecureString
    $keyPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($protectedKey)
  }else{
    if(-not (Test-Path -LiteralPath $RecoveryKeyFile) -or -not (Test-Path -LiteralPath $VerifyFile)){throw 'Both the encrypted backup and portable key file are required.'}
    & (Join-Path $PSScriptRoot 'protect-recovery-directory.ps1') -Repository (Get-Location).Path
  }
  $phrase=Read-Host 'Recovery passphrase (16+ characters; keep it separately in your password manager)' -AsSecureString
  $phrasePointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($phrase)
  $phraseText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($phrasePointer)
  if($Export){
    $confirm=Read-Host 'Confirm recovery passphrase' -AsSecureString
    $confirmPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm)
    if(-not [string]::Equals($phraseText,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmPointer),[StringComparison]::Ordinal)){throw 'Passphrases do not match.'}
    $secretInput=@{key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer);passphrase=$phraseText} | ConvertTo-Json -Compress
    $secretInput | & node $typescriptRunner (Join-Path $PSScriptRoot 'recovery-key.ts') $OutputFile
  }else{
    $secretInput=@{passphrase=$phraseText} | ConvertTo-Json -Compress
    $secretInput | & node $typescriptRunner (Join-Path $PSScriptRoot 'backup-db.ts') "--verify-encrypted=$VerifyFile" "--recovery-key=$RecoveryKeyFile" '--recovery-drill'
  }
  if($LASTEXITCODE -ne 0){throw 'Portable recovery operation failed. Original backups and keys are unchanged.'}
}finally{
  $secretInput=$null; $phraseText=$null
  foreach($pointer in @($keyPointer,$phrasePointer,$confirmPointer)){
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
  }
  foreach($secret in @($protectedKey,$phrase,$confirm)){if($null -ne $secret){$secret.Dispose()}}
}
