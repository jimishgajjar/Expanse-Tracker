import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {homedir} from "node:os";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {parse} from "dotenv";

// Local launcher only. Keep the key outside both the repository and the DB.
// Windows protects it with the signed-in user's DPAPI; Unix uses a private file.
export function sandboxEnvironment(){
  if(process.env.VERCEL||process.env.NODE_ENV==="production")throw Error("Local development only.");
  const file=".env.plaid-sandbox.local",config=existsSync(file)?parse(readFileSync(file)):{};
  const client=process.env.PLAID_SANDBOX_CLIENT_ID??config.PLAID_SANDBOX_CLIENT_ID;
  const secret=process.env.PLAID_SANDBOX_SECRET??config.PLAID_SANDBOX_SECRET;
  if(!client?.trim()||!secret?.trim())throw Error("Configure Sandbox keys in .env.plaid-sandbox.local first.");
  const folder=join(homedir(),".expense-tracker-sandbox");mkdirSync(folder,{recursive:true,mode:0o700});
  const windows=process.platform==="win32",path=join(folder,windows?"token-key-v1.dpapi":"token-key-v1");
  if(!existsSync(path)&&existsSync(".pglite-bank-inbox"))throw Error("Sandbox token key is missing. Restore the original key before opening this inbox.");
  let key;
  if(windows){
    const script=`$ErrorActionPreference='Stop'
$p=$env:LOCAL_BANK_KEY_FILE
[void][Reflection.Assembly]::LoadWithPartialName('System.Security')
if(!(Test-Path -LiteralPath $p)){
  $bytes=New-Object byte[] 32
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  $protected=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $stream=[IO.File]::Open($p,[IO.FileMode]::CreateNew)
  try{$stream.Write($protected,0,$protected.Length)}finally{$stream.Dispose()}
}
$bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($p),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($bytes)`;
    key=execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",script],{env:{...process.env,LOCAL_BANK_KEY_FILE:path},windowsHide:true,encoding:"utf8"}).trim();
  }else{
    if(!existsSync(path))writeFileSync(path,randomBytes(32).toString("base64"),{flag:"wx",mode:0o600});
    key=readFileSync(path,"utf8").trim();
  }
  if(Buffer.from(key,"base64").length!==32)throw Error("Invalid Sandbox token key.");
  return {PLAID_SANDBOX_CLIENT_ID:client.trim(),PLAID_SANDBOX_SECRET:secret.trim(),BANK_LOCAL_KEY:key,BANK_LOCAL_LINK:"1"};
}
