import { redirect } from "next/navigation";
import { fileImportsEnabled } from "@/lib/file-import-model";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { recentBatches } from "@/lib/file-import-store";
import { FileImportReview } from "@/components/file-import-review";
import { LegacyImportForm } from "@/components/import-form";
import { PageShell } from "@/components/page-shell";
export const dynamic="force-dynamic";
export default async function ImportsPage(){
  const [user,ws]=await Promise.all([getCurrentUser(),getActiveWorkspace()]);
  if(!user||!ws)redirect("/login");
  const editor=["owner","member"].includes(ws.role);
  return <PageShell back={{href:"/?tab=settings",label:"Settings"}} eyebrow={ws.name} title="Import transactions" width="wide">
    {!editor?<p className="dashboard-panel page-section">Editing access is required to import transactions.</p>:fileImportsEnabled()?<FileImportReview recent={await recentBatches(await getDb(),{workspace:ws.id,actor:user.id,name:user.name})}/>:<LegacyImportForm/>}
  </PageShell>;
}
