import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { observe, type Feed } from "./observe";
import { SandboxError, SandboxProvider } from "./provider";

export async function checkSandbox(provider:SandboxProvider,wait:()=>Promise<void>=()=>delay(2000)){
  const user="m3-synthetic-"+randomUUID();
  await provider.createLink(user);
  const {public_token}=await provider.createTestItem();
  let access:string,item:string;
  try {
    ({access_token:access,item_id:item}=await provider.exchange(public_token));
  } catch {
    // Exchange can fail after the remote creation succeeds: do not create
    // another Item automatically when its state is unknown.
    throw new SandboxError("EXCHANGE_UNCONFIRMED: check Sandbox Items before retrying.");
  }
  try {
    const inventory=await provider.accounts(access);
    if(inventory.item.item_id!==item)throw new SandboxError("ITEM_SCOPE_MISMATCH");
    const account=inventory.accounts.find(a=>a.type==="depository"&&a.subtype==="checking");
    if(!account)throw new SandboxError("EXPECTED_TEST_CHECKING_ACCOUNT_MISSING");
    await provider.createLink(user,access); // update mode for the existing Item
    let feed:Feed={accountId:account.account_id,cursor:null,rows:new Map()};
    const read=(accountId:string,cursor:string|null)=>provider.sync(access,accountId,cursor);
    let pages=0;
    for(let i=0;i<12;i++){
      try {const update=await observe(feed,read);feed=update.feed;pages+=update.pages;}
      catch(e){if(!(e instanceof SandboxError)||e.message!=="PRODUCT_NOT_READY")throw e;}
      if(feed.rows.size)break;
      if(i<11)await wait();
    }
    if(!feed.rows.size)throw new SandboxError("TEST_TRANSACTIONS_NOT_AVAILABLE");
    const next=await observe(feed,read);
    return {environment:"sandbox",mode:"synthetic, observation only",selectedAccounts:1,
      observedTransactions:next.feed.rows.size,initialPages:pages,incrementalPages:next.pages,
      updateStatus:next.status,itemRemoved:true};
  } finally {
    try {await provider.remove(access);}
    catch {throw new SandboxError("CLEANUP_UNCONFIRMED: check the test Item in Plaid Sandbox before retrying.");}
  }
}
