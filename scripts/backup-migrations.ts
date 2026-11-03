import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Keep scheduled backups working while an additive release is only local.
 * Never migrates the source. The selected journal is bundled into the backup. */
export function backupMigrationsForTables(folder: string, tables: string[]): string {
  const optional = [["reconciliation_sessions","0012_statement_reviews"],["file_imports","0013_file_imports"]] as const;
  if (tables.includes("file_imports") && !tables.includes("reconciliation_sessions")) throw new Error("Unexpected partial import schema.");
  const absent=optional.filter(([table,tag])=>existsSync(join(folder,tag+".sql"))&&!tables.includes(table)).map(([,tag])=>String(tag));
  if(!absent.length)return folder;
  const journal = JSON.parse(readFileSync(join(folder,"meta/_journal.json"),"utf8"));
  if (journal.entries.some((entry:{idx:number})=>entry.idx>13)) throw new Error("Review backup compatibility for newer migrations before continuing.");
  const compatible = mkdtempSync(join(tmpdir(),"expense-backup-schema-"));
  cpSync(folder,compatible,{recursive:true});
  journal.entries = journal.entries.filter((entry:{tag:string})=>!absent.includes(entry.tag));
  writeFileSync(join(compatible,"meta/_journal.json"),JSON.stringify(journal,null,2));
  return compatible;
}
