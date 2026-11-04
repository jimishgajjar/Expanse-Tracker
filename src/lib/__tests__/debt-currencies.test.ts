import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import ExcelJS from "exceljs";
import { applyFinance } from "../finance-posting";
import { financeReport } from "../finance-position";
import { converted, payoff, transferResidual } from "../finance-money";
import { exportFinance } from "../finance-export";
import { hostedFinanceRelease } from "../finance-release";

const db=new PGlite(), owner={workspace:"home",actor:"owner"};
const write=(input:unknown)=>applyFinance(db,owner,input);
const date="2025-01-10", asOf=date+"T12:00:00Z", source="Synthetic statement";
function review(account:string,currency:string,role:string,expected:string,interpretation="signed") {
  return {action:"review",account,currency,role,report:"CAD",expected,interpretation};
}
function entry(kind:string,account:string,amount:string,extra:Record<string,unknown>={}) {
  return {action:"post",request:crypto.randomUUID(),kind,account,amount,date,source,asOf,...extra};
}
beforeAll(async()=>{
  await migrate(drizzle(db),{migrationsFolder:"./drizzle"});
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'),('view','view@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Home','owner'),('away','Away','owner');
    INSERT INTO workspace_members VALUES('home','owner','owner',now()),('home','view','viewer',now());
    INSERT INTO accounts(id,name,workspace_id,initial_balance) VALUES ('bank','Bank','home',1000),('card','Card','home',100),
    ('usd','Dollars','home',0),('jpy','Yen','home',0),('loan','Loan','home',-300),('other','Foreign tracker','away',2901);
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES('old','home','bank','expense',10,'2025-01-01','Existing');`);
},30000);
afterAll(()=>db.close());

it("requires distinct release opt-ins and rejects an ordinary database for a hosted preview",()=>{
  const env={...process.env,VERCEL_ENV:"preview",FINANCE_RELEASE:"debt",FINANCE_ENABLE_PRODUCTION:"",
    DATABASE_URL:"postgresql://example.neon.tech/neondb"};
  expect(hostedFinanceRelease(env)).toBeNull();
  expect(hostedFinanceRelease({...env,DATABASE_URL:"postgresql://example.neon.tech/m8_rehearsal_"+"a".repeat(32)})).toBe("debt");
  expect(hostedFinanceRelease({...env,VERCEL_ENV:"production"})).toBeNull();
  expect(hostedFinanceRelease({...env,VERCEL_ENV:"production",FINANCE_ENABLE_PRODUCTION:"yes",FINANCE_RELEASE:"currencies"})).toBe("currencies");
});

it("reviews balances explicitly, reconciles three currencies and preserves booked cash flow when a valuation changes",async()=>{
  const initial=(await db.query("SELECT * FROM transactions WHERE id='old'")).rows;
  expect((await financeReport(db,owner)).report).toBe(null);
  await expect(applyFinance(db,{...owner,actor:"view"},review("card","CAD","card","100","owed"))).rejects.toThrow("access");
  await expect(write(review("bank","CAD","cash","1000"))).rejects.toThrow("balance changed");
  await write(review("bank","CAD","cash","990"));
  await write(review("card","CAD","card","100","owed"));
  await write(review("loan","CAD","loan","-300"));
  await write(review("usd","USD","cash","0"));
  await write(review("jpy","JPY","cash","0"));
  const purchase=entry("purchase","card","50");
  await write(purchase); await write(purchase);
  const {rows:[receipt]}=await db.query<{transaction_id:string}>("SELECT transaction_id FROM finance_bookings WHERE operation_id=$1",[purchase.request]);
  await write(entry("refund","card","10",{refundOf:receipt.transaction_id}));
  await expect(write(entry("refund","card","41",{refundOf:receipt.transaction_id}))).rejects.toThrow("remaining");
  await write(entry("interest","card","5"));
  await write(entry("payment","bank","60",{destination:"card",interestPaid:"5"}));
  await write(entry("transfer","bank","100",{destination:"usd",received:"72",exchange:"0.72",fee:"2"}));
  await write(entry("transfer","usd","12",{destination:"jpy",received:"1800",exchange:"150",rate:"1.4"}));
  await write(entry("purchase","usd","10",{originalCurrency:"JPY",original:"1500",originalRate:"0.0066666667",rate:"1.4"}));
  await expect(write(entry("purchase","jpy","0.01",{rate:"0.01"}))).rejects.toThrow("decimal");
  let data=await financeReport(db,owner);
  expect(data.position?.worth).toBeNull();
  expect(data.position?.native).toEqual({CAD:"443.00",USD:"50.00",JPY:"1800"});
  const quote=(currency:string,rate:string,time=asOf)=>write({action:"quote",currency,rate,asOf:time,source});
  await quote("USD","1.4");await quote("JPY","0.01");
  data=await financeReport(db,owner);
  // Bank 828, card -85, loan -300, USD 70 CAD and JPY 18 CAD.
  expect(data.position).toMatchObject({cash:"916.00",debt:"385.00",worth:"531.00"});
  expect(Number(data.flows.spending)).toBe(71);expect(Number(data.flows.income)).toBe(0);
  await quote("USD","2","2025-02-01T00:00:00Z");
  const changed=await financeReport(db,owner);
  expect(changed.position?.worth).toBe("561.00");expect(changed.flows).toEqual(data.flows);
  expect((await db.query("SELECT * FROM transactions WHERE id='old'")).rows).toEqual(initial);
  expect((await db.query<{initial_balance:string}>("SELECT initial_balance FROM accounts WHERE id='card'")).rows[0].initial_balance).toBe("100.00");
  await expect(db.query("UPDATE transactions SET amount=40 WHERE id=$1",[receipt.transaction_id])).rejects.toThrow("immutable");
  const book=new ExcelJS.Workbook();await exportFinance(book,db,owner);
  const restored=new ExcelJS.Workbook();await restored.xlsx.load(await book.xlsx.writeBuffer());
  const rows=JSON.stringify(restored.getWorksheet("finance_bookings")?.getSheetValues());
  expect(rows).toContain("original_rate");expect(rows).toContain("1500");expect(rows).toContain("principal_paid");
  expect(JSON.stringify(restored.worksheets.map(s=>s.getSheetValues()))).not.toContain("Foreign tracker");
},30000);

it("enforces statement periods, payoff assumptions and atomic fee/repayment posting",async()=>{
  const statement={action:"statement",account:"card",starts:"2025-01-01",ends:"2025-01-31",due:"2025-02-21",closing:"85",minimum:"20"};
  await write(statement);await expect(write(statement)).rejects.toThrow("overlaps");
  await write({action:"terms",account:"loan",apr:"12",payment:"110",fee:"1",variable:true});
  const data=await financeReport(db,owner);
  expect(data.projections[0].scenario).toEqual({status:"Projected",months:3,interest:"5.81",fees:"3.00",finalPayment:"88.81"});
  const before=data.position;
  await expect(write(entry("transfer","bank","10",{destination:"usd",received:"5",exchange:"0.5",fee:"-1"}))).rejects.toThrow();
  await expect(write(entry("payment","bank","10",{destination:"card",interestPaid:"11"}))).rejects.toThrow("allocations");
  expect((await financeReport(db,owner)).position).toEqual(before);
});

it("rounds in minor units, limits residuals and detects non-amortizing loans",()=>{
  expect(converted("0.01","CAD","JPY","50")).toBe("1");
  expect(converted("-0.01","CAD","JPY","50")).toBe("-1");
  expect(transferResidual("1","USD","149","JPY","150")).toBe("-1");
  expect(()=>transferResidual("1","USD","148","JPY","150")).toThrow("more than one");
  expect(payoff("100","CAD","12","1","0")).toEqual({status:"Payment does not cover charges"});
});

it("leaves historical foreign cash flow and uncertain transfer receipts incomplete until explicitly booked",async()=>{
  const s={workspace:"legacy",actor:"owner"};
  await db.exec(`INSERT INTO workspaces(id,name,owner_id) VALUES('legacy','Older ledger','owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('legacy','owner','owner');
    INSERT INTO accounts(id,name,workspace_id,initial_balance) VALUES('ca2','CAD cash','legacy',100),('jp2','Yen cash','legacy',0);
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('historic-fx','legacy','ca2','jp2',10.25,'2025-01-10');
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date) VALUES('historic-buy','legacy','jp2','expense',20,'2025-01-10');`);
  await applyFinance(db,s,review("ca2","CAD","cash","89.75"),true);
  await expect(applyFinance(db,s,review("jp2","JPY","cash","-9.75"),true)).rejects.toThrow("one confirmed currency");
  await applyFinance(db,s,review("jp2","JPY","cash","-9.75"));
  let result=await financeReport(db,s);
  expect(result.position?.worth).toBeNull();
  expect(result.flows.missing).toBe(1);
  await applyFinance(db,s,entry("transfer","ca2","10.25",{existing:"historic-fx",destination:"jp2",received:"1025",exchange:"100"}));
  await applyFinance(db,s,entry("purchase","jp2","20",{existing:"historic-buy",rate:"0.01"}));
  await applyFinance(db,s,{action:"quote",currency:"JPY",rate:"0.02",asOf,source});
  result=await financeReport(db,s);
  expect(result.position?.worth).toBe("109.85");
  expect(Number(result.flows.spending)).toBe(0.2);
  expect(result.flows.missing).toBe(0);
  const n=await db.query<{n:number}>("SELECT count(*)::int n FROM transactions WHERE workspace_id='legacy'");
  expect(n.rows[0].n).toBe(1);
  await expect(applyFinance(db,{workspace:"away",actor:"view"},entry("income","ca2","5"))).rejects.toThrow("access");
  await expect(applyFinance(db,s,entry("transfer","ca2","1",{destination:"card",received:"1",exchange:"1"}))).rejects.toThrow("Confirm this account");
});
