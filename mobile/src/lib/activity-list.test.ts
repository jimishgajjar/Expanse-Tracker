import { expect,it } from "vitest";
import { activityGroups } from "./activity-list";
import type { Account,Transaction,Transfer } from "./types";

it("shows a transfer on both participating accounts and keeps it out of income, expense and other accounts",()=>{
  const accounts=[{id:"one",name:"Checking"},{id:"two",name:"Savings"}] as Account[];
  const txs:Transaction[]=[{id:"tx",accountId:"one",date:"2026-11-01",type:"expense",amount:5,note:"Lunch",
    categoryId:null,account:null,category:null,createdByName:null,tags:[]}];
  const moves:Transfer[]=[{id:"transfer",fromAccountId:"one",toAccountId:"two",date:"2026-11-02",amount:3,note:""}];
  for(const account of ["one","two"]) expect(activityGroups(txs,moves,accounts,"transfer","saving",account)[0][1][0].kind).toBe("transfer");
  expect(activityGroups(txs,moves,accounts,"all","","three")).toEqual([]);
  expect(activityGroups(txs,moves,accounts,"income","")).toEqual([]);
  expect(activityGroups(txs,moves,accounts,"expense","").map(([date])=>date)).toEqual(["2026-11-01"]);
  expect(activityGroups(txs,moves,accounts,"all","").map(([date])=>date)).toEqual(["2026-11-02","2026-11-01"]);
});
