import {notFound,redirect} from "next/navigation";
import {getActiveWorkspace} from "@/lib/workspace";
import {sandboxInboxEnabled} from "@/lib/plaid-sandbox/config";
import {localInbox,reviewOptions} from "@/lib/plaid-sandbox/local";
import {BankInboxPanel} from "@/components/bank-inbox-panel";
export const dynamic="force-dynamic";
export default async function BankInboxPage(){
  if(!sandboxInboxEnabled())notFound();
  const owner=await getActiveWorkspace();
  if(!owner||owner.role!=="owner")redirect("/?tab=accounts");
  const view=await localInbox().view(owner.id);
  return <BankInboxPanel key={owner.id} workspace={owner.id} initial={view} initialOptions={await reviewOptions(owner.id,view)}/>;
}
