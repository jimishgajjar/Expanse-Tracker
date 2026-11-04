import {afterAll,beforeAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {refundReview,linkRefund,unlinkRefund} from "../refund-links";
import {planningMonth,savePlan,savePayday} from "../monthly-planning";
import {previewBulk} from "../bulk-edits";
import {categoryPostings} from "../category-postings";

const client=new PGlite(),db=drizzle(client),scope={workspace:"home",actor:"owner"};
const credit={credit:"credit",purchase:"shoes",purchaseAmount:"50",purchaseDate:"2024-12-30",creditDate:"2025-01-03",creditAmount:"12",
  portions:[{categoryId:"clothes",amount:"10"},{categoryId:"sport",amount:"2"}]};
beforeAll(async()=>{
  await migrate(db,{migrationsFolder:"./drizzle"});
  await client.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','o@example.invalid','x'),('viewer','v@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Home','owner'),('work','Work','owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','owner','owner'),('home','viewer','viewer'),('work','owner','owner');
    INSERT INTO accounts(id,workspace_id,name,type) VALUES('bank','home','Bank','bank'),('else','work','Other','bank');
    INSERT INTO categories(id,workspace_id,name,kind) VALUES('clothes','home','Clothes','expense'),('sport','home','Sport','expense');
    INSERT INTO transactions(id,workspace_id,account_id,date,type,amount,note) VALUES
      ('shoes','home','bank','2024-12-30','expense',50,'Shoes'),('credit','home','bank','2025-01-03','income',12,'Return'),
      ('credit2','home','bank','2025-01-04','income',30,'Return 2'),('other','work','else','2024-12-01','expense',99,'Foreign');
    INSERT INTO purchase_allocations VALUES('shoes','clothes',40),('shoes','sport',10);`);
},60000);
afterAll(()=>client.close());

it("limits review and writes to authorized people, posted credits and original categories",async()=>{
  expect((await refundReview(client,scope,"credit","Shoes")).purchases.map(p=>p.id)).toEqual(["shoes"]);
  expect((await refundReview(client,scope,"credit","missing")).purchases).toEqual([]);
  await expect(linkRefund(client,{...scope,actor:"viewer"},credit)).rejects.toThrow("Access");
  await expect(linkRefund(client,scope,{...credit,purchase:"other"})).rejects.toThrow("changed");
  await expect(linkRefund(client,scope,{...credit,creditDate:"2025-01-02"})).rejects.toThrow("changed");
  await expect(linkRefund(client,scope,{...credit,portions:[{categoryId:"clothes",amount:"1"}]})).rejects.toThrow("entire credit");
  await expect(linkRefund(client,scope,{...credit,portions:[{categoryId:"none",amount:"12"}]})).rejects.toThrow("available");
});
it("recognizes split partial refunds when received and preserves the ledger through link and unlink",async()=>{
  await savePlan(client,scope,{month:"2024-12",category:"clothes",amount:"50",rollover:true,version:0});
  await savePayday(client,scope,{account:"bank",start:"2025-01-01",next:"2025-01-08",cadence:"weekly",expected:"100",limit:"60",version:0});
  const month=(m:string)=>planningMonth(client,scope,m,"2025-01-10");
  const before=await month("2025-01");
  await linkRefund(client,scope,credit);
  await expect(linkRefund(client,scope,credit)).rejects.toThrow("already");
  expect((await month("2024-12")).periods[0].spent).toBe("40.00");
  let updated=await month("2025-01");
  expect(updated.accounts).toEqual(before.accounts);
  expect(updated.periods[0]).toMatchObject({carry:"10.00",spent:"-10.00",remaining:"70.00"});
  expect(updated.paydays[0]).toMatchObject({spent:"-12.00",income:"30.00",remaining:"72.00"});
  const bulk=await previewBulk(client,{...scope,name:"Owner"},{ids:["credit"],operation:{kind:"category",id:null},batch:crypto.randomUUID()});
  expect(bulk.rows[0].skip).toBe("Linked refund");
  const reviewed=await refundReview(client,scope,"credit");
  expect(reviewed.link?.portions).toHaveLength(2);
  expect(reviewed.choices.map(p=>p.remaining)).toEqual(["30.00","8.00"]);
  const second={...credit,credit:"credit2",creditDate:"2025-01-04",creditAmount:"30"};
  await expect(linkRefund(client,scope,{...second,portions:[{categoryId:"sport",amount:"30"}]})).rejects.toThrow("available");
  await linkRefund(client,scope,{...second,portions:[{categoryId:"clothes",amount:"30"}]});
  const net=categoryPostings(db as unknown as Parameters<typeof categoryPostings>[0],true,true);
  expect((await db.select().from(net)).filter(p=>p.amount.startsWith("-"))).toHaveLength(3);
  await expect(client.exec("UPDATE transactions SET amount=10 WHERE id='credit'")).rejects.toThrow("Unlink");
  await expect(client.exec("UPDATE purchase_allocations SET amount=20 WHERE transaction_id='shoes'")).rejects.toThrow("Unlink");
  await expect(client.exec("DELETE FROM transactions WHERE id='shoes'")).rejects.toThrow();
  await unlinkRefund(client,scope,"credit2",(await refundReview(client,scope,"credit2")).link!.id);
  await expect(unlinkRefund(client,scope,"credit","stale")).rejects.toThrow("changed");
  await unlinkRefund(client,scope,"credit",reviewed.link!.id);
  updated=await month("2025-01");
  expect(updated).toEqual(before);
});
