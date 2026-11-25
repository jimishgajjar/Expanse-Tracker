import { notFound } from "next/navigation";
import { AccountSharing } from "@/components/account-sharing";
import { getHouseholdDb } from "@/lib/household-db";
import { getSession } from "@/lib/session";
import { sharingOptions, ShareError } from "@/lib/account-share-store";
import { PageShell } from "@/components/page-shell";

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const [db,session,{id}] = await Promise.all([getHouseholdDb(),getSession(),params]);
  if (!db || !session?.workspaceId) notFound();
  let options;
  try { options=await sharingOptions(db,{workspace:session.workspaceId,actor:session.user.id,sessionId:session.sessionId},id); }
  catch(error) { if (error instanceof ShareError) notFound(); throw error; }
  return <PageShell back={{href:"/accounts/"+encodeURIComponent(id),label:"Account details"}} eyebrow={options.household} title={`Share ${options.name}`}
    description="Share a read-only copy with one household member. Future activity stays private until you approve another copy.">
    <AccountSharing key={id} account={id} initial={options}/>
  </PageShell>;
}
