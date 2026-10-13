import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

function keyFrom(hex: string) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error("A 32-byte backup encryption key is required.");
  return Buffer.from(hex,"hex");
}
export function encryptBackup(value: unknown, keyHex: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm",keyFrom(keyHex),iv);
  cipher.setAAD(Buffer.from("expense-tracker-backup-v1"));
  const content = Buffer.concat([cipher.update(gzipSync(JSON.stringify(value))),cipher.final()]);
  return Buffer.concat([Buffer.from("ETB1"),iv,cipher.getAuthTag(),content]);
}
export function decryptBackup(bytes: Buffer, keyHex: string): unknown {
  if (bytes.length < 33 || bytes.subarray(0,4).toString() !== "ETB1") throw new Error("Invalid backup format.");
  const decipher = createDecipheriv("aes-256-gcm",keyFrom(keyHex),bytes.subarray(4,16));
  decipher.setAAD(Buffer.from("expense-tracker-backup-v1"));
  decipher.setAuthTag(bytes.subarray(16,32));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(32)),decipher.final()])).toString("utf8"));
}
