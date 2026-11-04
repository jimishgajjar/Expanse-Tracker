import {randomUUID,createHash} from "node:crypto";
import type {PGlite} from "@electric-sql/pglite";
import {SandboxError,type SandboxProvider,type Observation} from "./provider";
import {observe} from "./observe";
import {sealToken,openToken} from "./vault";

type Account={account_id:string;name?:string;type:string;subtype:string|null};
type Conn={workspace:string;id:string;phase:"link"|"exchange"|"pick"|"active"|"disconnect";expires:number;token:string|null;item:string|null;choices:Account[];selected:string|null;cursor:string|null;version:number;synced:string|null};
const fail=(code:string):never=>{throw new SandboxError(code);};
const aad=(ws:string,id:string)=>JSON.stringify(["plaid-sandbox",ws,id]);
export const observationVersion=(row:Observation)=>createHash("sha256").update(JSON.stringify([
  row.account_id,row.transaction_id,row.date,row.amount,row.iso_currency_code,row.pending,row.name??null,
])).digest("hex");
export class Inbox {
  private readonly ready:Promise<unknown>;
  constructor(private db:PGlite,private provider:SandboxProvider,private key:Buffer){
    this.ready=db.exec(`CREATE TABLE IF NOT EXISTS connections(workspace text PRIMARY KEY,id text NOT NULL UNIQUE,phase text NOT NULL,
      expires float8 NOT NULL,token text,item text,choices jsonb NOT NULL DEFAULT '[]',selected text,cursor text,version int NOT NULL DEFAULT 0,synced text);
      CREATE TABLE IF NOT EXISTS observations(connection text REFERENCES connections(id) ON DELETE CASCADE,id text,record jsonb NOT NULL,PRIMARY KEY(connection,id));`);
  }
  private async conn(ws:string,id?:string){
    await this.ready;const c=(await this.db.query<Conn>("SELECT * FROM connections WHERE workspace=$1",[ws])).rows[0];
    if(id&&c?.id!==id)fail("STALE_CONNECTION");return c;
  }
  private token(c:Conn){if(!c.token)return fail("NO_CONNECTION");return openToken(c.token,this.key,aad(c.workspace,c.id));}
  async withObservation<T>(workspace:string, connection:string, recordId:string, work:(row:Observation)=>Promise<T>) {
    await this.ready;
    // Hold the local inbox transaction while the review commits in the preview ledger.
    // A concurrent sync or disconnect must finish before or after the decision.
    return this.db.transaction(async tx=>{
      const {rows}=await tx.query<{record:Observation}>(`SELECT o.record FROM observations o
        JOIN connections c ON c.id=o.connection WHERE c.workspace=$1 AND c.id=$2 AND o.id=$3
        AND c.phase='active' AND c.selected=o.record->>'account_id' FOR SHARE OF c,o`,[workspace,connection,recordId]);
      if(!rows.length)throw new SandboxError("STALE_CONNECTION");
      return work(rows[0].record);
    });
  }
  private async changed(query:string,args:unknown[]){
    if(!(await this.db.query(query,args)).affectedRows)fail("STALE_CONNECTION");
  }
  async view(ws:string){
    await this.ready;
    return this.db.transaction(async tx=>{
      const c=(await tx.query<Conn>("SELECT * FROM connections WHERE workspace=$1",[ws])).rows[0];
      if(!c)return null;
      const records=(await tx.query<{record:Observation}>("SELECT record FROM observations WHERE connection=$1 ORDER BY record->>'date' DESC,id",[c.id])).rows.map(r=>r.record);
      return {id:c.id,phase:c.phase,accounts:c.choices.map(a=>({id:a.account_id,label:a.name??a.subtype??a.type})),
        selected:c.selected,synced:c.synced,records:records.map(r=>({id:r.transaction_id,version:observationVersion(r),date:r.date,label:r.name??"Bank transaction",amount:r.amount,currency:r.iso_currency_code,pending:r.pending}))};
    });
  }
  async begin(ws:string){
    await this.ready;const id=randomUUID();
    // An abandoned, unexchanged Link token can safely expire. Never replace an exchanged Item.
    await this.changed("INSERT INTO connections(workspace,id,phase,expires) VALUES($1,$2,'link',$3) ON CONFLICT(workspace) DO UPDATE SET id=excluded.id,expires=excluded.expires WHERE connections.phase='link' AND connections.expires<$4",[ws,id,Date.now()+30*60000,Date.now()]);
    try {const result=await this.provider.createLink(createHash("sha256").update(ws).digest("hex"));return {id,linkToken:result.link_token};}
    catch(e){await this.cancel(ws,id);throw e;}
  }
  async cancel(ws:string,id:string){await this.ready;await this.db.query("DELETE FROM connections WHERE workspace=$1 AND id=$2 AND phase='link'",[ws,id]);}
  async clearUnconfirmed(ws:string,id:string){
    await this.ready;
    await this.changed("DELETE FROM connections WHERE workspace=$1 AND id=$2 AND phase='exchange' AND token IS NULL AND expires<$3",[ws,id,Date.now()]);
  }
  async exchange(ws:string,id:string,publicToken:string){
    await this.ready;
    await this.changed("UPDATE connections SET phase='exchange',expires=$4 WHERE workspace=$1 AND id=$2 AND phase='link' AND expires>$3",[ws,id,Date.now(),Date.now()+60000]);
    // Ambiguous exchange must not create another Item. Keep the attempt for inspection.
    const result=await this.provider.exchange(publicToken);
    try{await this.changed("UPDATE connections SET phase='pick',token=$3,item=$4 WHERE workspace=$1 AND id=$2 AND phase='exchange'",[ws,id,sealToken(result.access_token,this.key,aad(ws,id)),result.item_id]);}
    catch(e){await this.provider.remove(result.access_token);await this.db.query("DELETE FROM connections WHERE workspace=$1 AND id=$2 AND phase='exchange' AND token IS NULL",[ws,id]);throw e;}
    await this.accounts(ws,id);
  }
  async accounts(ws:string,id:string){
    const c=await this.conn(ws,id);if(c.phase!=="pick")fail("ACCOUNT_SELECTION_CLOSED");
    const inventory=await this.provider.accounts(this.token(c));if(inventory.item.item_id!==c.item)fail("ITEM_SCOPE_MISMATCH");
    await this.changed("UPDATE connections SET choices=$3 WHERE workspace=$1 AND id=$2 AND phase='pick'",[ws,id,JSON.stringify(inventory.accounts.filter(a=>["credit","depository"].includes(a.type)))]);
  }
  async select(ws:string,id:string,account:string){
    await this.ready;
    await this.changed("UPDATE connections SET phase='active',selected=$3 WHERE workspace=$1 AND id=$2 AND phase='pick' AND EXISTS(SELECT 1 FROM jsonb_array_elements(choices) a WHERE a->>'account_id'=$3)",[ws,id,account]);
  }
  async repair(ws:string,id:string){
    const c=await this.conn(ws,id);
    if(c.phase!=="active")return fail("SELECT_ACCOUNT_FIRST");
    const result=await this.provider.createLink(createHash("sha256").update(ws).digest("hex"),this.token(c));
    return {id,linkToken:result.link_token};
  }
  async sync(ws:string,id:string){
    const c=await this.conn(ws,id);if(c.phase!=="active"||!c.selected)return fail("SELECT_ACCOUNT_FIRST");
    const token=this.token(c);
    const stored=await this.db.query<{record:Observation}>("SELECT record FROM observations WHERE connection=$1",[id]);
    const update=await observe({accountId:c.selected,cursor:c.cursor,rows:new Map(stored.rows.map(r=>[r.record.transaction_id,r.record]))},(account,cursor)=>this.provider.sync(token,account,cursor));
    await this.db.transaction(async tx=>{
      if(!(await tx.query("UPDATE connections SET cursor=$3,synced=$4,version=version+1 WHERE workspace=$1 AND id=$2 AND phase='active' AND version=$5",[ws,id,update.feed.cursor,new Date().toISOString(),c.version])).affectedRows)fail("STALE_CONNECTION");
      await tx.query("DELETE FROM observations WHERE connection=$1",[id]);
      await tx.query("INSERT INTO observations(connection,id,record) SELECT $1,r->>'transaction_id',r FROM jsonb_array_elements($2::jsonb) r",[id,JSON.stringify([...update.feed.rows.values()])]);
    });
  }
  async disconnect(ws:string,id:string){
    const c=await this.conn(ws,id);const token=this.token(c);
    await this.changed("UPDATE connections SET phase='disconnect',version=version+1 WHERE workspace=$1 AND id=$2 AND phase IN ('active','pick','disconnect')",[ws,id]);
    try{await this.provider.remove(token);}catch(e){if(!(e instanceof SandboxError)||e.message!=="INVALID_ACCESS_TOKEN")throw e;}
    await this.db.query("DELETE FROM connections WHERE workspace=$1 AND id=$2 AND phase='disconnect'",[ws,id]);
  }
}
export type InboxView=Awaited<ReturnType<Inbox["view"]>>;
