import Link from "next/link";
import { redirect } from "next/navigation";
import { fileImportsEnabled } from "@/lib/file-import-model";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { recentBatches } from "@/lib/file-import-store";
import { FileImportReview } from "@/components/file-import-review";
import { LegacyImportForm } from "@/components/import-form";
export const dynamic="force-dynamic";
export default async function ImportsPage(){
  const [user,ws]=await Promise.all([getCurrentUser(),getActiveWorkspace()]);
  if(!user||!ws)redirect("/login");
  const editor=["owner","member"].includes(ws.role);
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
    <Link className="text-sm text-brand" href="/?tab=settings">← Settings</Link>
    <h1 className="text-2xl font-semibold tracking-tight">Import transactions</h1>
    {!editor?<p>Editing access is required to import transactions.</p>:fileImportsEnabled()?<FileImportReview recent={await recentBatches(await getDb(),{workspace:ws.id,actor:user.id,name:user.name})}/>:<LegacyImportForm/>}
  </main>;
}
