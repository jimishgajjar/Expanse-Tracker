import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
export function sealToken(token:string,key:Buffer,scope:string) {
  const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key,iv);
  cipher.setAAD(Buffer.from(scope));
  const data=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),data.toString("base64")].join(".");
}
export function openToken(blob:string,key:Buffer,scope:string) {
  const [version,iv,tag,data]=blob.split(".");
  if(version!=="v1")throw Error("Unknown token encryption version.");
  const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64"));
  decipher.setAAD(Buffer.from(scope));decipher.setAuthTag(Buffer.from(tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(data,"base64")),decipher.final()]).toString("utf8");
}
