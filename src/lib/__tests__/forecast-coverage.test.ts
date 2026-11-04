import {afterAll,beforeAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {forecastBalances} from "../balance-forecast";

const db=new PGlite(),viewer={workspace:"w",actor:"u"};
const read=(account:string|null=null,horizon="30")=>forecastBalances(db,viewer,{account,horizon},new Date(2024,3,1,12));

beforeAll(async()=>{
  await migrate(drizzle(db),{migrationsFolder:"./drizzle"});
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('u','test@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('w','Household','u'),('other','Private','u');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('w','u','viewer');
    INSERT INTO accounts(id,workspace_id,name,type,archived) VALUES('main','w','Main','bank',false),('stale','w','Old','bank',false),
      ('empty','w','New','cash',false),('reviewed','w','Reviewed','bank',false),('sent','w','Sender','bank',false),
      ('received','w','Receiver','bank',false),('archive','w','Archived','bank',true),('private','other','Foreign','bank',false);
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('transfer','w','sent','received',2,'2024-03-02');
    INSERT INTO reconciliation_sessions(id,workspace_id,account_id,start_date,end_date,closing_balance,snapshot,actor_name,status)
      VALUES('done','w','reviewed','2024-03-01','2024-03-31',0,'{}','User','completed'),
            ('draft','w','stale','2024-03-01','2024-03-31',0,'{}','User','draft'),
            ('future','w','empty','2024-04-01','2024-04-30',0,'{}','User','completed');
    INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date) VALUES
      ('old','w','stale','income','Old',2,'2024-03-01'),('future','w','empty','income','Planned',3,'2024-04-05');
    INSERT INTO recurring(id,workspace_id,account_id,type,note,amount,frequency,next_date,end_date) VALUES
      ('ended','w','main','expense','Subscription',9,'monthly','2024-03-31','2024-03-31');
  `);
  for(const [account,workspace,label] of [
    ["main","w","Hydro Co."],["main","w","Subscription"],["main","w","Grocer"],["main","w","Recorded"],
    ["main","w","Variable"],["main","w","Irregular"],["archive","w","Archived bill"],["private","other","Secret bill"]
  ]){
    for(const [i,date] of ["2024-01-31","2024-02-29","2024-03-31"].entries()){
      await db.query("INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date) VALUES($1,$2,$3,'expense',$4,$5,$6)",
        [crypto.randomUUID(),workspace,account,label==="Hydro Co."&&i===2?"HYDRO CO":label,label==="Variable"&&i===0?100:10+i,label==="Irregular"&&i===1?"2024-02-11":date]);
    }
  }
  await db.exec(`INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date) VALUES
    ('extra','w','main','expense','Grocer',11,'2024-02-25'),('later','w','main','expense','Recorded',13,'2024-05-02');`);
},60000);
afterAll(()=>db.close());
it("checks dated activity, both transfer legs and completed statement periods within scope",async()=>{
  const all=await read();
  expect(all.coverage.accountCount).toBe(6);
  expect(all.coverage.accounts).toEqual([
    {id:"empty",name:"New",lastActivity:null,statementEnd:null},
    {id:"stale",name:"Old",lastActivity:"2024-03-01",statementEnd:null},
  ]);
  expect((await read("reviewed","payday")).coverage).toMatchObject({accountCount:1,accounts:[],bills:[]});
  expect((await read("stale","payday")).coverage.accounts).toHaveLength(1);
  expect((await read("archive")).coverage).toEqual({accountCount:0,accounts:[],bills:[]});
  await expect(read("private")).rejects.toThrow("workspace");
});
it("shows the first uncovered monthly payment with evidence, without changing the projected balance",async()=>{
  const result=await read("main");
  expect(result.coverage.bills).toEqual([{account:"main",accountName:"Main",label:"HYDRO CO",expected:"2024-04-30",
    history:[{date:"2024-01-31",amount:"10.00"},{date:"2024-02-29",amount:"11.00"},{date:"2024-03-31",amount:"12.00"}]}]);
  expect(result.projection?.closing).toBe(result.opening);
  const longer=await read("main","60");
  expect(longer.coverage.bills.find(b=>b.label==="Recorded")?.expected).toBe("2024-05-31");
  expect(longer.projection?.days.flatMap(d=>d.events).map(e=>e.label)).toEqual(["Recorded"]);
  expect((await read("reviewed")).coverage.bills).toEqual([]);
  const overdue=async(day:number)=>forecastBalances(db,viewer,{account:"main",horizon:"30"},new Date(2024,4,day,12));
  expect((await overdue(14)).coverage.bills.some(b=>b.label==="HYDRO CO")).toBe(true);
  expect((await overdue(15)).coverage.bills.some(b=>b.label==="HYDRO CO")).toBe(false);
});
