"use client";

import { type ReactElement, useState } from "react";
import { History } from "lucide-react";
import { ManagerPanel } from "./manager-panel";
import { Button } from "./ui/button";
import { useRemoteData } from "./use-remote-data";
import { useFormat } from "./settings-provider";
import type { CategoryDTO, AccountDTO } from "@/lib/queries";
import type { HouseholdHistory } from "@/lib/household-history";

export function TransactionHistory({id,accounts,categories,trigger}: {id:string;accounts:AccountDTO[];categories:CategoryDTO[];trigger?:ReactElement}) {
  const [open,setOpen] = useState(false);
  return <ManagerPanel open={open} onOpenChange={setOpen} title="History & access" description="Who can see this entry and how it has changed." icon={History} trigger={trigger ?? <Button size="icon-sm" variant="ghost" aria-label="View transaction history and access" title="History & access"><History className="size-3.5" /></Button>}>
    {open && <HistoryBody key={id} id={id} accounts={accounts} categories={categories}/>}
  </ManagerPanel>;
}

function HistoryBody({id,accounts,categories}: {id:string;accounts:AccountDTO[];categories:CategoryDTO[]}) {
  const {money} = useFormat();
  const {data,error,retry} = useRemoteData<HouseholdHistory>(`/api/transaction-history/${encodeURIComponent(id)}`);
  const labels:Record<string,string> = {amount:"Amount",type:"Type",date:"Date",note:"Note",account_id:"Account",category_id:"Category",tag_ids:"Tags"};
  function display(key:string,value:unknown) {
    if(value == null || value === "") return "None";
    if(key === "amount") return money(Number(value));
    if(key === "account_id") return accounts.find(a => a.id === value)?.name ?? "Removed account";
    if(key === "category_id") return categories.find(c => c.id === value)?.name ?? "Removed category";
    if(Array.isArray(value)) return value.length ? `${value.length} tag(s)` : "None";
    return String(value);
  }
  if (error) return <div role="alert">{error} <Button onClick={retry}>Try again</Button></div>;
  if (!data) return <p role="status">Loading history…</p>;
  return <div className="space-y-4">
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border p-3 text-sm">
      <dt className="text-muted-foreground">Entered by</dt><dd className="break-words">{data.access.recordedBy ?? "Not recorded"}</dd>
      <dt className="text-muted-foreground">Tracker</dt><dd className="break-words">{data.access.tracker}</dd>
      <dt className="text-muted-foreground">Visible to</dt><dd>{data.access.personal ? "Only you" : "All members of this tracker"}</dd>
      <dt className="text-muted-foreground">Your access</dt><dd>{data.access.canEdit ? "Can edit" : "View only"}</dd>
    </dl>
    <h3 className="text-sm font-semibold">Edit history</h3>
    {!data.history.length ? <p className="text-sm text-muted-foreground">No recorded history. Earlier changes may not have been recorded.</p> : <>
      <p className="text-xs text-muted-foreground">Up to 100 most recent events.</p>
      {data.history.map(row => <article className="dashboard-panel space-y-3 p-4" key={row.id}>
        <header><h4 className="text-sm font-semibold">{row.created ? "Created" : "Edited"} · {row.actorName || "Workspace member"}</h4>
          <time className="text-xs text-muted-foreground" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time></header>
        {row.correctionReason && <p className="text-sm"><strong>Statement correction:</strong> {row.correctionReason}</p>}
        <dl className="space-y-2">{Object.keys(labels).filter(key => JSON.stringify(row.before[key]) !== JSON.stringify(row.after[key])).map(key => <div key={key} className="text-sm">
          <dt className="text-xs text-muted-foreground">{labels[key]}</dt><dd className="break-words">
            {!row.created && <><span className="text-muted-foreground">{display(key,row.before[key])}</span><span aria-label="changed to"> → </span></>}{display(key,row.after[key])}
          </dd></div>)}</dl>
      </article>)}
    </>}
  </div>;
}
