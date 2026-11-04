import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountSharing } from "@/components/account-sharing";
import { getHouseholdDb } from "@/lib/household-db";
import { getSession } from "@/lib/session";
import { sharingOptions, ShareError } from "@/lib/account-share-store";

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const [db,session,{id}] = await Promise.all([getHouseholdDb(),getSession(),params]);
  if (!db || !session?.workspaceId) notFound();
  let options;
  try { options=await sharingOptions(db,{workspace:session.workspaceId,actor:session.user.id,sessionId:session.sessionId},id); }
  catch(error) { if (error instanceof ShareError) notFound(); throw error; }
  return <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
    <Link href={"/accounts/"+encodeURIComponent(id)} className="text-sm text-brand">← Account details</Link>
    <AccountSharing key={id} account={id} initial={options}/>
  </main>;
}
