import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { pilotDatabase } from "@/lib/pilot-release";
import { FeedbackForm } from "@/components/pilot-forms";
export const dynamic="force-dynamic";
export default async function Feedback() {
  const session=await getSession();
  if (!session) redirect("/login?next=/feedback");
  const [workspace,db]=await Promise.all([getActiveWorkspaceId(),pilotDatabase()]);
  if (!workspace || !db) notFound();
  const {rows}=await db.query<{id:string;severity:string;status:string}>(`SELECT id,severity,status FROM pilot_feedback
    WHERE workspace_id=$1 AND actor=$2 AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member','viewer')) ORDER BY created_at DESC LIMIT 10`,[workspace,session.user.id]);
  return <main className="pilot-content mx-auto max-w-xl space-y-5 px-4 py-6"><Link href="/?tab=settings" className="text-brand underline">← Settings</Link>
    <h1 className="text-2xl font-semibold">Pilot feedback</h1><FeedbackForm workspace={workspace}/>
    <section><h2 className="font-semibold">Your recent reports</h2>{!rows.length && <p className="text-sm">Your references and review status will appear here.</p>}
    <ul>{rows.map(r=><li className="break-words border-b py-2 text-sm" key={r.id}>{r.severity} · {r.status} · {r.id}</li>)}</ul></section></main>;
}
