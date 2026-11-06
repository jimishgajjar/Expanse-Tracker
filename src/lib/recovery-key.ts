import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";

// Fixed v1 parameters prevent an unauthenticated key file from choosing excessive work.
// Node crypto.scrypt; OWASP's scrypt baseline N=2^17, r=8, p=1 (reviewed 2026-11-06).
const header=Buffer.from("ETK1"),aad=Buffer.from("expense-tracker-recovery-key-v1");
async function derive(passphrase:string,salt:Buffer){
  if(typeof passphrase!=="string"||passphrase.length<16||Buffer.byteLength(passphrase,"utf8")>1024)
    throw Error("Use a recovery passphrase of at least 16 characters and at most 1024 UTF-8 bytes.");
  return new Promise<Buffer>((resolve,reject)=>scrypt(passphrase,salt,32,{N:131072,r:8,p:1,maxmem:256*1024*1024},(err,key)=>err?reject(err):resolve(key)));
}

export async function wrapRecoveryKey(keyHex:string,passphrase:string){
  if(!/^[a-f0-9]{64}$/i.test(keyHex))throw Error("A 32-byte backup key is required.");
  const salt=randomBytes(16),iv=randomBytes(12),wrappingKey=await derive(passphrase,salt),key=Buffer.from(keyHex,"hex");
  try{
    const cipher=createCipheriv("aes-256-gcm",wrappingKey,iv);
    cipher.setAAD(aad);
    const encrypted=Buffer.concat([cipher.update(key),cipher.final()]);
    return Buffer.concat([header,salt,iv,cipher.getAuthTag(),encrypted]);
  }finally{wrappingKey.fill(0);key.fill(0);}
}

export async function unwrapRecoveryKey(file:Buffer,passphrase:string){
  if(file.length!==80||!file.subarray(0,4).equals(header))throw Error("Invalid recovery-key format.");
  const wrappingKey=await derive(passphrase,file.subarray(4,20));
  let clear:Buffer|undefined;
  try{
    const decipher=createDecipheriv("aes-256-gcm",wrappingKey,file.subarray(20,32));
    decipher.setAAD(aad);decipher.setAuthTag(file.subarray(32,48));
    clear=Buffer.concat([decipher.update(file.subarray(48)),decipher.final()]);
    return clear.toString("hex");
  }catch{throw Error("Cannot unlock recovery key. Check the passphrase and the original key file.");}
  finally{wrappingKey.fill(0);clear?.fill(0);}
}
