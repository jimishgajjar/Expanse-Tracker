import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { wrapRecoveryKey, unwrapRecoveryKey } from "../src/lib/recovery-key";
import { recoverySecretInput } from "./recovery-secret-input";

async function main(){
  if(process.argv.length!==3||!process.argv[2].endsWith(".etrk"))throw Error("Choose a new .etrk recovery-key file.");
  const input=await recoverySecretInput();
  if(!input.key)throw Error("The protected backup key was not supplied.");
  const target=resolve(process.argv[2]),encrypted=await wrapRecoveryKey(input.key,input.passphrase);
  // Refuse to replace any existing recovery key, including one belonging to an older backup.
  writeFileSync(target,encrypted,{flag:"wx",mode:0o600});
  const checked=await unwrapRecoveryKey(readFileSync(target),input.passphrase);
  if(!timingSafeEqual(Buffer.from(checked,"hex"),Buffer.from(input.key,"hex")))throw Error("Recovery-key verification failed.");
  console.log(JSON.stringify({file:target,encrypted:true,readbackVerified:true,originalKeyChanged:false}));
}
main().catch(()=>{console.error("Recovery-key export failed. Check the local passphrase and choose a new .etrk path; existing keys were not replaced.");process.exitCode=1;});
