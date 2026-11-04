import { SandboxError,type SandboxPage,type Observation } from "./provider";

export type Feed = {accountId:string;cursor:string|null;rows:ReadonlyMap<string,Observation>};

// Each cursor belongs to exactly one account. Never mutate the committed feed:
// discard all staged pages on error, including on a pagination restart.
export async function observe(previous:Feed, read:(accountId:string,cursor:string|null)=>Promise<SandboxPage>) {
  for(let attempt=0;attempt<3;attempt++){
    const rows=new Map(previous.rows);
    const seen=new Set<string>();
    let cursor=previous.cursor;
    try {
      for(let pages=1;pages<=100;pages++){
        const result=await read(previous.accountId,cursor);
        if(result.transactions_update_status==="NOT_READY" || !result.next_cursor){
          if(result.has_more || result.added.length || result.modified.length || result.removed.length)throw new SandboxError("INCONSISTENT_PROVIDER_PAGE");
          throw new SandboxError("PRODUCT_NOT_READY");
        }
        for(const record of [...result.added,...result.modified]){
          if(record.account_id!==previous.accountId)throw new SandboxError("ACCOUNT_SCOPE_MISMATCH");
          rows.set(record.transaction_id,record);
        }
        for(const record of result.removed){
          if(record.account_id && record.account_id!==previous.accountId)throw new SandboxError("ACCOUNT_SCOPE_MISMATCH");
          rows.delete(record.transaction_id);
        }
        if(!result.has_more)return {feed:{accountId:previous.accountId,rows,cursor:result.next_cursor},pages,status:result.transactions_update_status};
        if(result.next_cursor===previous.cursor || seen.has(result.next_cursor))throw new SandboxError("REPEATED_CURSOR");
        seen.add(result.next_cursor);cursor=result.next_cursor;
      }
      throw new SandboxError("PAGE_LIMIT");
    } catch(e){
      if(!(e instanceof SandboxError)||e.message!=="TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"||attempt===2)throw e;
    }
  }
  throw new SandboxError("RESTART_LIMIT");
}
