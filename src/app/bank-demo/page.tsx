import { notFound, redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/workspace";
import { bankDemoEnabled } from "@/lib/bank-demo/config";
import { BankDemo } from "@/components/bank-demo";

export const dynamic = "force-dynamic";

export default async function BankDemoPage() {
  if (!bankDemoEnabled()) notFound();
  const workspace = await getActiveWorkspace();
  if (workspace?.role !== "owner") redirect("/?tab=accounts");
  return <BankDemo key={workspace.id} />;
}
