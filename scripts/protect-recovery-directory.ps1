#requires -Version 7.0
param([Parameter(Mandatory)][string]$Repository)
$ErrorActionPreference='Stop'
$recoveryRoot=Join-Path $Repository 'backups/recovery-drills'
foreach($recoveryParent in @((Join-Path $Repository 'backups'),$recoveryRoot)){
  if((Test-Path -LiteralPath $recoveryParent) -and ((Get-Item -LiteralPath $recoveryParent).Attributes -band [IO.FileAttributes]::ReparsePoint)){
    throw 'Recovery directories must not be links or junctions.'
  }
}
New-Item -ItemType Directory -Force -Path $recoveryRoot | Out-Null
if($IsWindows){
  $currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls $recoveryRoot /inheritance:r /grant:r "*${currentSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot protect the recovery directory.'}
  $extraAccess=(Get-Acl -LiteralPath $recoveryRoot).Access | Where-Object {
    $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($currentSid,'S-1-5-18')
  }
  if($extraAccess){throw 'Recovery directory grants access to another identity. Review its permissions before restoring private data.'}
}else{
  [IO.File]::SetUnixFileMode($recoveryRoot,([IO.UnixFileMode]::UserRead -bor [IO.UnixFileMode]::UserWrite -bor [IO.UnixFileMode]::UserExecute))
}
