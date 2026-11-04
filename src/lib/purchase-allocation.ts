import { z } from "zod";
import type {TransactionDTO} from "./queries";
export type Allocation = { categoryId:string; amount:string };
export function cents(text:string) {
  if(!/^\d{1,12}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction=""]=text.split(".");
  return BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0"));
}
export const allocationSchema=z.array(z.object({
  categoryId:z.string().min(1,"Choose a category for each portion.").max(128),
  amount:z.string().refine(s=>(cents(s)??BigInt(0))>BigInt(0),"Each portion needs a positive amount with up to two decimals.")
    .transform(s=>{const [whole,frac=""]=s.split(".");return BigInt(whole)+"."+frac.padEnd(2,"0");}),
})).min(2,"Choose at least two categories.").max(20,"Use at most 20 categories.")
  .refine(rows=>new Set(rows.map(r=>r.categoryId)).size===rows.length,"Choose a different category for each portion.")
  .transform(rows=>rows.sort((a,b)=>a.categoryId<b.categoryId?-1:1));
export function balanced(total:string,lines:Allocation[]) {
  return cents(total)===lines.reduce((sum,row)=>sum+(cents(row.amount)??BigInt(0)),BigInt(0));
}
export function purchasesInCategory(transactions:TransactionDTO[],id:string):TransactionDTO[]{
  return transactions.flatMap(t=>{
    const portion=t.allocations?.find(line=>line.categoryId===id);
    if(portion)return [{...t,receiptAmount:t.amount,amount:Number(portion.amount)}];
    return t.categoryId===id?[t]:[];
  });
}
