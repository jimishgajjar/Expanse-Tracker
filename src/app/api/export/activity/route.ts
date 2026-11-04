import { getSession } from "@/lib/session";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { activityCsv,activityPart } from "@/lib/activity-exports";

export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const [session,workspace]=await Promise.all([getSession(),getActiveWorkspaceId()]);
  const p=new URL(request.url).searchParams,kind=p.get("kind");
  const headers={"Cache-Control":"private, no-store"};
  if (!session) return new Response("Sign in to download activity.",{status:401,headers});
  if (!workspace || p.get("workspace")!==workspace) return new Response("Reopen exports from the intended household.",{status:409,headers});
  if (kind!=="transactions" && kind!=="transfers") return new Response("Choose transactions or transfers.",{status:400,headers});
  const {rows}=await activityPart(await getDb(),workspace,session.user.id,kind,p.get("after")??"");
  return new Response(activityCsv(rows),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="'+kind+'-part.csv"'}});
}
