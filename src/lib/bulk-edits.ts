import type {HouseholdDb, HouseholdReader} from "./household-db";
import {createHash,randomUUID} from "node:crypto";
import {z} from "zod";

const ref=z.string().min(1).max(128);
const operation=z.discriminatedUnion("kind",[
  z.object({kind:z.literal("category"),id:ref.nullable()}),
  z.object({kind:z.enum(["addTag","removeTag"]),id:ref}),
]);
export type BulkOperation=z.infer<typeof operation>;
const selection=z.object({ids:z.array(ref).min(1).max(25).refine(ids=>new Set(ids).size===ids.length),
  operation,batch:z.uuid()});
type Scope={workspace:string;actor:string;name:string};
type Snapshot={id:string;type:string;note:string;date:string;amount:string;category_id:string|null;tag_ids:string[];allocations:unknown[]};
type Entry={state:Snapshot;revision:number;refund_linked:boolean};
type Labels={categories:Map<string,{name:string;kind:string}>;tags:Map<string,string>};
type BulkMeta={batch:string;stage:"apply"|"undo";key:string;request:string;expected:string};
export class BulkError extends Error {}
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fingerprint=(e:Entry)=>hash([e.revision,e.state]);

async function authorize(tx:HouseholdReader,s:Scope){
  if(!(await tx.query("SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member') FOR SHARE",[s.workspace,s.actor])).rows.length)
    throw new BulkError("Edit access is required.");
}
async function entries(tx:HouseholdReader,ws:string,ids:string[]){
  const {rows}=await tx.query<Entry>(`SELECT to_jsonb(t)||jsonb_build_object('amount',t.amount::text,
    'allocations',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.category_id) FROM purchase_allocations p WHERE p.transaction_id=t.id),'[]'),
    'tag_ids',coalesce((SELECT jsonb_agg(tag_id ORDER BY tag_id) FROM transaction_tags WHERE transaction_id=t.id),'[]')) AS state,
    EXISTS(SELECT 1 FROM refund_links r WHERE r.workspace_id=t.workspace_id AND (r.credit_id=t.id OR r.purchase_id=t.id)) AS refund_linked,
    (SELECT count(*)::int FROM transaction_history h WHERE h.workspace_id=t.workspace_id AND h.transaction_id=t.id) AS revision
    FROM transactions t WHERE t.workspace_id=$1 AND t.id=ANY($2::text[]) ORDER BY t.id FOR UPDATE OF t`,[ws,ids]);
  return new Map(rows.map(e=>[e.state.id,e]));
}
async function labels(tx:HouseholdReader,ws:string):Promise<Labels>{
  const cats=await tx.query<{id:string;name:string;kind:string}>("SELECT id,name,kind FROM categories WHERE workspace_id=$1",[ws]);
  const tags=await tx.query<{id:string;name:string}>("SELECT id,name FROM tags WHERE workspace_id=$1",[ws]);
  return {categories:new Map(cats.rows.map(c=>[c.id,c])),tags:new Map(tags.rows.map(t=>[t.id,t.name]))};
}
function planRow(e:Entry,op:BulkOperation,refs:Labels){
  const t=e.state;
  let skip="";
  const before=op.kind==="category"?(refs.categories.get(t.category_id??"")?.name??"Uncategorized"):t.tag_ids.map(id=>refs.tags.get(id)??"Removed tag").join(", ")||"No tags";
  let after=before;
  if(op.kind==="category"){
    const category=op.id?refs.categories.get(op.id):null;
    if(op.id&&!category)throw new BulkError("That category is unavailable.");
    if(e.refund_linked)skip="Linked refund";
    else if(t.allocations.length)skip="Split purchase";
    else if(category&&category.kind!==t.type)skip="Different transaction type";
    else if(op.id===t.category_id)skip="Already set";
    else after=category?.name??"Uncategorized";
  }else{
    if(!refs.tags.has(op.id))throw new BulkError("That tag is unavailable.");
    const has=t.tag_ids.includes(op.id);
    if(has===(op.kind==="addTag"))skip=has?"Tag already present":"Tag not present";
    else if(op.kind==="addTag"&&t.tag_ids.length>=100)skip="Tag limit reached";
    else after=(has?t.tag_ids.filter(id=>id!==op.id):[...t.tag_ids,op.id]).map(id=>refs.tags.get(id)).join(", ")||"No tags";
  }
  return {id:t.id,label:t.note||"Transaction",date:t.date,amount:t.amount,before,after,skip};
}
async function prepare(tx:HouseholdReader,s:Scope,input:z.infer<typeof selection>){
  const saved=await entries(tx,s.workspace,input.ids),refs=await labels(tx,s.workspace);
  if(saved.size!==input.ids.length)throw new BulkError("One or more selected entries are unavailable. Refresh Activity.");
  const rows=[...saved.values()].map(e=>planRow(e,input.operation,refs));
  const key=hash([s.workspace,s.actor,input.batch,input.operation,rows,[...saved.values()].map(fingerprint)]);
  return {saved,rows,key};
}
export async function previewBulk(db:HouseholdDb,s:Scope,raw:unknown){
  const input=selection.parse(raw);
  return db.transaction(async tx=>{
    await authorize(tx,s);
    const {rows,key}=await prepare(tx,s,input);
    return {rows,key};
  });
}
async function change(tx:HouseholdReader,ws:string,id:string,op:BulkOperation){
  if(op.kind==="category")await tx.query("UPDATE transactions SET category_id=$3 WHERE workspace_id=$1 AND id=$2",[ws,id,op.id]);
  else if(op.kind==="addTag")await tx.query("INSERT INTO transaction_tags(transaction_id,tag_id) VALUES($1,$2)",[id,op.id]);
  else await tx.query("DELETE FROM transaction_tags WHERE transaction_id=$1 AND tag_id=$2",[id,op.id]);
}
async function record(tx:HouseholdReader,s:Scope,before:Snapshot,after:Entry,meta:Omit<BulkMeta,"expected">,op:BulkOperation){
  const expected=fingerprint({...after,revision:after.revision+1});
  await tx.query(`INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after")
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),s.workspace,before.id,s.actor,s.name,JSON.stringify(before),
      JSON.stringify({...after.state,_bulk:{...meta,expected,op}})]);
}
async function batchHistory(tx:HouseholdReader,s:Scope,batch:string){
  return (await tx.query<{transaction_id:string;before:Snapshot;meta:BulkMeta&{op:BulkOperation}}>(
    `SELECT transaction_id,"before","after"->'_bulk' AS meta FROM transaction_history WHERE workspace_id=$1 AND actor_id=$2
      AND "after"->'_bulk'->>'batch'=$3 ORDER BY transaction_id`,[s.workspace,s.actor,batch])).rows;
}
export async function applyBulk(db:HouseholdDb,s:Scope,raw:unknown){
  const input=selection.extend({key:z.string().length(64)}).parse(raw);
  const request=hash([[...input.ids].sort(),input.operation]);
  return db.transaction(async tx=>{
    await authorize(tx,s);
    const existing=(await batchHistory(tx,s,input.batch)).filter(h=>h.meta.stage==="apply");
    if(existing.length){
      if(existing[0].meta.key!==input.key||existing[0].meta.request!==request)throw new BulkError("This batch was already used. Start a new preview.");
      return {changed:existing.length};
    }
    const {rows,key,saved}=await prepare(tx,s,input);
    if(key!==input.key)throw new BulkError("The selection changed after preview. Preview it again.");
    const changed=rows.filter(r=>!r.skip);
    for(const row of changed)await change(tx,s.workspace,row.id,input.operation);
    const after=await entries(tx,s.workspace,changed.map(r=>r.id));
    for(const {id} of changed)await record(tx,s,saved.get(id)!.state,after.get(id)!,{batch:input.batch,key,request,stage:"apply"},input.operation);
    return {changed:changed.length};
  });
}
export async function undoBulk(db:HouseholdDb,s:Scope,raw:unknown){
  const batch=z.uuid().parse(raw);
  return db.transaction(async tx=>{
    await authorize(tx,s);
    const history=await batchHistory(tx,s,batch),applied=history.filter(h=>h.meta.stage==="apply");
    if(!applied.length)throw new BulkError("This batch is unavailable.");
    const undone=new Set(history.filter(h=>h.meta.stage==="undo").map(h=>h.transaction_id));
    const current=await entries(tx,s.workspace,applied.map(h=>h.transaction_id)),refs=await labels(tx,s.workspace);
    const outcomes:{id:string;label:string;status:string}[]=[];
    for(const h of applied){
      const e=current.get(h.transaction_id),op=h.meta.op;
      let status="Restored";
      if(undone.has(h.transaction_id))status="Already restored";
      else if(!e||fingerprint(e)!==h.meta.expected)status="Skipped · edited or deleted";
      else {
        const inverse:BulkOperation=op.kind==="category"?{kind:"category",id:h.before.category_id}:{kind:op.kind==="addTag"?"removeTag":"addTag",id:op.id};
        const available=inverse.kind==="category"?(!inverse.id||refs.categories.get(inverse.id)?.kind===e.state.type):refs.tags.has(inverse.id);
        if(e.refund_linked&&inverse.kind==="category")status="Skipped · linked refund";
        else if(!available)status="Skipped · original category or tag unavailable";
        else{
          await change(tx,s.workspace,h.transaction_id,inverse);
          const after=(await entries(tx,s.workspace,[h.transaction_id])).get(h.transaction_id)!;
          await record(tx,s,e.state,after,{batch,key:h.meta.key,request:h.meta.request,stage:"undo"},inverse);
        }
      }
      outcomes.push({id:h.transaction_id,label:h.before.note||h.before.date,status});
    }
    return outcomes;
  });
}
export async function bulkTools(db:HouseholdDb,s:Scope){
  return db.transaction(async tx=>{
    await authorize(tx,s);
    const {tags}=await labels(tx,s.workspace);
    const {rows}=await tx.query<{id:string;date:string;count:number;restored:number}>(`SELECT "after"->'_bulk'->>'batch' AS id,
      (max(created_at) FILTER (WHERE "after"->'_bulk'->>'stage'='apply'))::text AS date,
      (count(*) FILTER (WHERE "after"->'_bulk'->>'stage'='apply'))::int AS count,
      (count(*) FILTER (WHERE "after"->'_bulk'->>'stage'='undo'))::int AS restored
      FROM transaction_history WHERE workspace_id=$1 AND actor_id=$2 AND "after"->'_bulk'->>'stage' IN ('apply','undo')
      GROUP BY 1 ORDER BY date DESC,id LIMIT 5`,[s.workspace,s.actor]);
    return {tags:[...tags].map(([id,name])=>({id,name})),batches:rows};
  });
}
