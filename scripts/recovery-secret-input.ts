/** Secrets arrive over the private stdin pipe, never command arguments or log output. */
export async function recoverySecretInput():Promise<{passphrase:string;key?:string}>{
  if(process.stdin.isTTY)throw Error("Use scripts/recovery-key.ps1 to enter the passphrase securely.");
  const chunks:Buffer[]=[];let length=0;let combined:Buffer|undefined;
  try{
    for await(const chunk of process.stdin){
      const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
      length+=bytes.length;
      if(length>16384){bytes.fill(0);throw Error("Secret input is too large.");}
      chunks.push(bytes);
    }
    combined=Buffer.concat(chunks);
    const input=JSON.parse(combined.toString("utf8"));
    if(!input||typeof input.passphrase!=="string"||(input.key!==undefined&&typeof input.key!=="string"))throw Error();
    return {passphrase:input.passphrase,...(input.key===undefined?{}:{key:input.key})};
  }catch{throw Error("Invalid secret input. Use the secure local prompt; do not supply secrets as command arguments.");}
  finally{combined?.fill(0);for(const chunk of chunks)chunk.fill(0);}
}
