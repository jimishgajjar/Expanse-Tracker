/** Operator-only local preview. Stop its dev server before opening this embedded store. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { z } from "zod";
async function triage(){
  const args=process.argv.slice(2);
  if(process.env.DATABASE_URL || process.env.VERCEL) throw Error("Use only the stopped, isolated local pilot preview.");
  const path=resolve(".pglite-pilot-preview");
  if(!existsSync(resolve(path,"PG_VERSION"))) throw Error("Open the isolated pilot preview first.");
  const db=new PGlite(path);
  try{
    if(args[0]==="list" && args.length===1){
      const {rows}=await db.query("SELECT id,severity,status,created_at FROM pilot_feedback WHERE status<>'resolved' ORDER BY CASE WHEN severity IN ('privacy','financial') THEN 0 ELSE 1 END,created_at LIMIT 100");
      console.table(rows);return;
    }
    const id=z.uuid().parse(args[1]);
    if(args[0]==="read" && args.length===2){
      const {rows}=await db.query("SELECT id,severity,status,message FROM pilot_feedback WHERE id=$1",[id]);
      if(!rows.length)throw Error("Unknown reference.");console.log(JSON.stringify(rows[0]));return;
    }
    if(args[0]==="set" && args.length===3){
      const status=z.enum(["received","investigating","resolved"]).parse(args[2]);
      const {rows}=await db.query("UPDATE pilot_feedback SET status=$2 WHERE id=$1 RETURNING id,status",[id,status]);
      if(!rows.length)throw Error("Unknown reference.");console.table(rows);return;
    }
    throw Error("Use list, read <reference>, or set <reference> <status>.");
  }finally{await db.close();}
}
triage().catch(e=>{console.error(e.message);process.exitCode=1;});
