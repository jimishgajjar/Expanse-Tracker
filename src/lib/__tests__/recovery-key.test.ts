import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { unwrapRecoveryKey, wrapRecoveryKey } from "../recovery-key";

describe("portable recovery key",()=>{
  it("round-trips with authenticated, randomized encryption without embedding the original key",async()=>{
    const key=randomBytes(32).toString("hex"),phrase="synthetic test phrase only 🔑";
    const a=await wrapRecoveryKey(key,phrase),b=await wrapRecoveryKey(key,phrase);
    expect(a.length).toBe(80);expect(a.equals(b)).toBe(false);
    expect(a.includes(Buffer.from(key,"hex"))).toBe(false);
    expect(await unwrapRecoveryKey(a,phrase)).toBe(key);
  });
  it("rejects a wrong passphrase and tampering in every envelope field",async()=>{
    const phrase="synthetic recovery phrase";
    const file=await wrapRecoveryKey(randomBytes(32).toString("hex"),phrase);
    await expect(unwrapRecoveryKey(file,"different synthetic phrase")).rejects.toThrow();
    for(const offset of [0,4,20,32,48]){
      const damaged=Buffer.from(file);damaged[offset]^=1;
      await expect(unwrapRecoveryKey(damaged,phrase)).rejects.toThrow();
    }
    await expect(unwrapRecoveryKey(file.subarray(0,79),phrase)).rejects.toThrow();
    await expect(unwrapRecoveryKey(Buffer.concat([file,Buffer.from([0])]),phrase)).rejects.toThrow();
  });
  it("rejects invalid keys, short phrases and oversized phrases before expensive derivation",async()=>{
    const key=randomBytes(32).toString("hex");
    await expect(wrapRecoveryKey("not a key","synthetic recovery phrase")).rejects.toThrow();
    await expect(wrapRecoveryKey(key,"too short")).rejects.toThrow();
    await expect(wrapRecoveryKey(key,"x".repeat(1025))).rejects.toThrow();
  });
});
