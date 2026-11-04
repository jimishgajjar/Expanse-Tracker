import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import sharp from "sharp";
import {sql} from "drizzle-orm";
import type {AppDb} from "./db";

export type ReceiptScope={workspace:string;actor:string};
export const maxReceiptBytes=5*1024*1024;
export class ReceiptError extends Error {}

export async function normalizeReceipt(bytes:Buffer,type:string) {
  const png=bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!bytes.length||bytes.length>maxReceiptBytes||!(png&&type==="image/png"||jpeg&&type==="image/jpeg"))
    throw new ReceiptError("Choose a JPEG or PNG photo up to 5 MB.");
  try{
    // Decode the image and retain only re-encoded pixels. Discard metadata and trailing file content.
    const decoder=sharp(bytes,{limitInputPixels:25_000_000,failOn:"warning"});
    const meta=await decoder.metadata();
    if((meta.pages??1)>1)throw Error();
    return await decoder.rotate().resize({width:2400,height:3200,fit:"inside",withoutEnlargement:true})
      .flatten({background:"#fff"}).jpeg({quality:86}).toBuffer();
  }catch{throw new ReceiptError("This photo could not be read. Choose a still image under 25 megapixels.");}
}
const allowed=(s:ReceiptScope,write:boolean)=>sql`EXISTS(SELECT 1 FROM workspace_members m
  WHERE m.workspace_id=t.workspace_id AND m.user_id=${s.actor}
    ${write?sql`AND m.role IN ('owner','member')`:sql`AND m.role IN ('owner','member','viewer')`})`;

export async function receiptInfo(db:AppDb,s:ReceiptScope,tx:string){
  const result=await db.execute(sql`SELECT r.id,r.bytes FROM transactions t LEFT JOIN receipt_images r ON r.transaction_id=t.id
    WHERE t.id=${tx} AND t.workspace_id=${s.workspace} AND ${allowed(s,false)}`);
  if(!result.rows.length)throw new ReceiptError("Receipt unavailable.");
  const row=result.rows[0];return row.id?{id:String(row.id),bytes:Number(row.bytes)}:null;
}
export async function attachReceipt(db:AppDb,s:ReceiptScope,tx:string,image:Buffer){
  const id=randomUUID();
  const result=await db.execute(sql`INSERT INTO receipt_images(transaction_id,id,jpeg,bytes)
    SELECT t.id,${id},${image.toString("base64")},${image.length} FROM transactions t
    WHERE t.id=${tx} AND t.workspace_id=${s.workspace} AND ${allowed(s,true)}
    ON CONFLICT(transaction_id) DO NOTHING RETURNING id`);
  if(!result.rows.length)throw new ReceiptError("Couldn’t attach the photo. Refresh to check the receipt and your access.");
}
export async function removeReceipt(db:AppDb,s:ReceiptScope,tx:string,id:string){
  const result=await db.execute(sql`DELETE FROM receipt_images r USING transactions t WHERE r.transaction_id=t.id
    AND t.id=${tx} AND r.id=${id} AND t.workspace_id=${s.workspace} AND ${allowed(s,true)} RETURNING r.id`);
  if(!result.rows.length)throw new ReceiptError("The receipt changed or is unavailable.");
}
export async function receiptBytes(db:AppDb,s:ReceiptScope,tx:string,id:string){
  const result=await db.execute(sql`SELECT r.jpeg FROM receipt_images r JOIN transactions t ON t.id=r.transaction_id
    WHERE t.workspace_id=${s.workspace} AND t.id=${tx} AND r.id=${id} AND ${allowed(s,false)}`);
  return result.rows.length?Buffer.from(String(result.rows[0].jpeg),"base64"):null;
}
export function receiptSignature(session:string,s:ReceiptScope,tx:string,id:string,expires:number){
  return createHmac("sha256",session).update(JSON.stringify(["receipt-v1",s.workspace,s.actor,tx,id,expires])).digest("hex");
}
export function validReceiptSignature(session:string,s:ReceiptScope,tx:string,id:string,expires:number,sig:string,now=Date.now()){
  return Number.isSafeInteger(expires)&&expires>now&&expires<=now+300000&&/^[a-f0-9]{64}$/.test(sig)&&
    timingSafeEqual(Buffer.from(sig),Buffer.from(receiptSignature(session,s,tx,id,expires)));
}
