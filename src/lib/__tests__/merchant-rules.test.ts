import {expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import type {AppDb} from "../db";
import {appendRule,readRuleBook} from "../merchant-rule-store";
import {matchingAlias,currentRules} from "../merchant-rule-model";

it("previews aliases, scopes rules and saves immutable revisions without changing ledger entries",async()=>{
  const client=new PGlite();
  try{
    const db=drizzle(client);await migrate(db,{migrationsFolder:"./drizzle"});
    await client.exec(`INSERT INTO users(id,email,password_hash) VALUES ('owner','a@example.invalid','x'),('viewer','b@example.invalid','x');
      INSERT INTO workspaces(id,name,owner_id) VALUES ('w','Test','owner'),('other','Other','owner');
      INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('w','owner','owner'),('w','viewer','viewer');
      INSERT INTO accounts(id,workspace_id,name) VALUES ('a','w','Bank'),('b','other','Bank');
      INSERT INTO categories(id,workspace_id,name,kind) VALUES ('food','w','Food','expense'),('salary','w','Salary','income');
      INSERT INTO tags(id,workspace_id,name) VALUES ('travel','w','Travel'),('private','other','Private');
      INSERT INTO transactions(id,workspace_id,account_id,type,note,date,amount) VALUES ('coffee','w','a','expense','Tims #104',CURRENT_DATE,9.87);`);
    const ledger=()=>client.query("SELECT * FROM transactions");
    const before=(await ledger()).rows;
    const scope={accountId:"a",kind:"expense" as const};
    const rule={...scope,id:crypto.randomUUID(),base:0,definition:{name:"Tim Hortons",aliases:["Tims"],categoryId:"food",tagIds:["travel"],enabled:true,priority:50}};
    const store=db as unknown as AppDb;
    expect(await appendRule(store,"w","viewer",rule)).toBe(false);
    expect(await appendRule(store,"w","owner",{...rule,accountId:"b"})).toBe(false);
    for(const invalid of [{tagIds:["private"]},{categoryId:"salary"}])
      expect(await appendRule(store,"w","owner",{...rule,definition:{...rule.definition,...invalid}})).toBe(false);
    expect(await appendRule(store,"w","owner",rule)).toBe(true);
    expect(await appendRule(store,"w","owner",rule)).toBe(false);
    const book=await readRuleBook(store,"w",scope);
    const first=currentRules(book.history)[0];
    expect(book.notes.filter(n=>matchingAlias(first,n))).toEqual(["Tims #104"]);
    expect(matchingAlias(first,"TIM–HORTONS #104")).toBe("Tim Hortons");
    expect(matchingAlias(first,"Tim Hortonsville")).toBeUndefined();
    expect((await readRuleBook(store,"other",scope)).history).toEqual([]);
    const change={...rule,base:1,definition:{...rule.definition,enabled:false}};
    const results=await Promise.all([appendRule(store,"w","owner",change),appendRule(store,"w","owner",change)]);
    expect(results.sort()).toEqual([false,true]);
    const other={...rule,id:crypto.randomUUID(),definition:{...rule.definition,priority:90}};
    await appendRule(store,"w","owner",other);
    const after=await readRuleBook(store,"w",scope);
    expect(after.history).toHaveLength(3);
    expect(currentRules(after.history).map(r=>[r.priority,r.enabled])).toEqual([[90,true],[50,false]]);
    expect((await ledger()).rows).toEqual(before);
  }finally{await client.close();}
},60000);
