import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppDb } from "./db";
import type { Batch, Entry, Source, Mapping } from "./file-import-model";
import { normalize, ImportProblem } from "./file-import-parser";
export type Scope={workspace:string;actor:string;name:string};
const authorized=(s:Scope)=>sql`EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=${s.workspace} AND user_id=${s.actor} AND role IN ('owner','member'))`;
const batchColumns=sql`id,filename,file_hash AS "fileHash",currency,version,rows,receipt`;
export async function loadBatch(db:AppDb,s:Scope,id:string):Promise<Batch>{
  const res=await db.execute(sql`SELECT ${batchColumns} FROM file_imports WHERE id=${id} AND workspace_id=${s.workspace} AND ${authorized(s)}`);
  if(!res.rows[0])throw new ImportProblem("Batch unavailable.");
  return res.rows[0] as unknown as Batch;
}
export async function importSetup(db:AppDb,s:Scope,headers:string[]){
  const res=await db.execute(sql`SELECT
    coalesce((SELECT currency_code FROM app_settings WHERE workspace_id=${s.workspace}),'INR') AS currency,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM accounts WHERE workspace_id=${s.workspace} AND NOT archived),'[]') AS accounts,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind)) FROM categories WHERE workspace_id=${s.workspace}),'[]') AS categories,
    (SELECT mapping FROM file_imports WHERE workspace_id=${s.workspace} AND headers=${JSON.stringify(headers)}::jsonb ORDER BY created_at DESC LIMIT 1) AS mapping
    WHERE ${authorized(s)}`);
  if(!res.rows[0])throw new ImportProblem("Editing access is required.");
  return res.rows[0] as unknown as {currency:string;accounts:{id:string;name:string}[];categories:{id:string;name:string;kind:string}[];mapping:Mapping|null};
}
export async function recentBatches(db:AppDb,s:Scope){
  const result=await db.execute(sql`SELECT id,filename,(receipt IS NOT NULL) AS approved FROM file_imports WHERE workspace_id=${s.workspace} AND ${authorized(s)} ORDER BY created_at DESC LIMIT 20`);
  return result.rows as unknown as {id:string;filename:string;approved:boolean}[];
}
export async function stageBatch(db:AppDb,s:Scope,file:Source,mapping:Mapping,confirmedCurrency:string){
  const setup=await importSetup(db,s,file.headers);
  if(setup.currency!==confirmedCurrency)throw new ImportProblem("Confirm the workspace currency before previewing rows.");
  const rows=normalize(file,mapping,setup.currency,setup.accounts,setup.categories);
  const valid=rows.filter(r=>!r.errors.length);
  if(valid.length){
    const matches=await db.execute(sql`SELECT r->>'line' AS line,file_import_candidates(${s.workspace},r->>'accountId',(r->>'date')::date,(r->>'type')::tx_kind,(r->>'amount')::numeric) AS candidates FROM jsonb_array_elements(${JSON.stringify(valid)}::jsonb) r WHERE ${authorized(s)}`);
    const byLine=new Map(matches.rows.map(m=>[Number(m.line),m.candidates as Entry["candidates"]]));
    for(const row of valid){row.candidates=byLine.get(row.line)??[];if(row.candidates.length>20)row.errors.push("Too many potential matches. Review this entry directly in Activity.");}
  }
  await db.execute(sql`INSERT INTO file_imports(id,workspace_id,file_hash,filename,headers,mapping,currency,rows,staged_by)
    SELECT ${randomUUID()},${s.workspace},${file.hash},${file.filename},${JSON.stringify(file.headers)}::jsonb,${JSON.stringify(mapping)}::jsonb,${setup.currency},${JSON.stringify(rows)}::jsonb,${s.actor} WHERE ${authorized(s)}
    ON CONFLICT(workspace_id,file_hash) DO UPDATE SET mapping=excluded.mapping,rows=excluded.rows,currency=excluded.currency,staged_by=excluded.staged_by,version=file_imports.version+1 WHERE file_imports.receipt IS NULL`);
  const res=await db.execute(sql`SELECT ${batchColumns} FROM file_imports WHERE workspace_id=${s.workspace} AND file_hash=${file.hash} AND ${authorized(s)}`);
  if(!res.rows[0])throw new ImportProblem("Preview not available.");
  return res.rows[0] as unknown as Batch;
}
export async function approveBatch(db:AppDb,s:Scope,id:string,version:number,choices:Record<string,string>){
  z.uuid().parse(id);z.int().positive().parse(version);z.record(z.string().regex(/^\d{1,4}$/),z.string().max(160)).refine(x=>Object.keys(x).length<=300).parse(choices);
  try{await db.execute(sql`SELECT approve_file_import(${s.workspace},${s.actor},${s.name},${id},${version},${JSON.stringify(choices)}::jsonb)`);}
  catch{throw new ImportProblem("Approval was not confirmed. Reopen the saved batch to check its receipt. If still pending, check your choices or preview the file again for updated matches.");}
  return loadBatch(db,s,id);
}
