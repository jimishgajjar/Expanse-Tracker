import { expect,it } from "vitest";
import { draftVault, type DraftBody } from "./draft-vault";

const body:DraftBody={type:"expense",amount:"3.25",date:"2026-10-31",accountId:"",categoryId:null,tagIds:[],note:"Bus fare"};
it("recovers the prior encrypted snapshot after a torn write and rejects a stale or in-flight edit",async()=>{
  const disk=new Map<string,string>();
  let failAt="";
  const store={getItem:async(k:string)=>disk.get(k)??null,deleteItem:async(k:string)=>{disk.delete(k);},
    setItem:async(k:string,v:string)=>{if(k===failAt)throw Error("killed");expect(new TextEncoder().encode(v).length).toBeLessThan(2048);disk.set(k,v);}};
  const key="actor_tracker",guard=()=>{};
  let vault=draftVault(store);
  const first=await vault.save(key,guard,"a",0,body);
  failAt=key;
  await expect(vault.save(key,guard,"a",1,{...body,note:"🟢".repeat(700)})).rejects.toThrow("killed");
  vault=draftVault(store);failAt="";
  expect(await vault.list(key,guard)).toEqual([first]);
  const updates=await Promise.allSettled([vault.save(key,guard,"a",1,body),vault.save(key,guard,"a",1,body)]);
  expect(updates.map(r=>r.status)).toEqual(["fulfilled","rejected"]);
  const pending=await vault.mark(key,guard,(await vault.list(key,guard))[0],true);
  await expect(vault.save(key,guard,"a",pending.revision,body)).rejects.toThrow("original save");
  await expect(vault.remove(key,guard,pending)).rejects.toThrow("original save");
  expect(await vault.list("someone_else",guard)).toEqual([]);
});
