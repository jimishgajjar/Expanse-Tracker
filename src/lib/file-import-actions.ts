"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./session";
import { getActiveWorkspace } from "./workspace";
import { getDb } from "./db";
import { fileImportsEnabled,defaultMapping,type Mapping } from "./file-import-model";
import { parseSource,ImportProblem } from "./file-import-parser";
import { approveBatch,importSetup,loadBatch,stageBatch } from "./file-import-store";
async function context(){
  if(!fileImportsEnabled())throw new ImportProblem("Reviewed imports are not enabled.");
  const [user,ws]=await Promise.all([getCurrentUser(),getActiveWorkspace()]);
  if(!user||!ws||!["owner","member"].includes(ws.role))throw new ImportProblem("Editing access is required.");
  return {db:await getDb(),s:{workspace:ws.id,actor:user.id,name:user.name||user.email}};
}
async function run<T>(fn:()=>Promise<T>){try{return {ok:true as const,data:await fn()};}catch(e){return {ok:false as const,error:e instanceof ImportProblem?e.message:"Unable to confirm the request. Check saved batches before retrying."};}}
export async function inspectImport(form:FormData){return run(async()=>{
  const {db,s}=await context(),file=await parseSource(form.get("file") as File),setup=await importSetup(db,s,file.headers);
  return {hash:file.hash,headers:file.headers,sample:file.lines[0].cells.map(c=>c.slice(0,100)),count:file.lines.length,currency:setup.currency,accounts:setup.accounts,mapping:setup.mapping??defaultMapping(file.headers),reused:!!setup.mapping};
});}
export async function previewImport(form:FormData,mapping:Mapping,hash:string,currency:string){return run(async()=>{
  const {db,s}=await context(),file=await parseSource(form.get("file") as File);
  if(file.hash!==hash)throw new ImportProblem("The file changed. Read the columns again.");
  return stageBatch(db,s,file,mapping,currency);
});}
export async function reopenImport(id:string){return run(async()=>{const {db,s}=await context();return loadBatch(db,s,id);});}
export async function commitImport(id:string,version:number,choices:Record<string,string>){return run(async()=>{
  const {db,s}=await context(),result=await approveBatch(db,s,id,version,choices);revalidatePath("/","layout");return result;
});}
