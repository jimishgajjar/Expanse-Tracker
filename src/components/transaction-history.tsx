"use client";

import { type ReactElement, useState } from "react";
import { History } from "lucide-react";
import { ManagerPanel } from "./manager-panel";
import { Button } from "./ui/button";
import { useRemoteData } from "./use-remote-data";
import { useFormat } from "./settings-provider";
import type { CategoryDTO, AccountDTO } from "@/lib/queries";

type Revision = {id:string;actorName:string;createdAt:string;before:Record<string,unknown>;after:Record<string,unknown>};
export function TransactionHistory({id,accounts,categories,trigger}: {id:string;accounts:AccountDTO[];categories:CategoryDTO[];trigger?:ReactElement}) {
  const [open,setOpen] = useState(false);
  const {money} = useFormat();
  const {data,error,retry} = useRemoteData<{history:Revision[]}>(open ? `/api/transaction-history/${encodeURIComponent(id)}` : null);
  const labels:Record<string,string> = {amount:"Amount",type:"Type",date:"Date",note:"Note",account_id:"Account",category_id:"Category",tag_ids:"Tags"};
  function display(key:string,value:unknown) {
    if(value == null || value === "") return "None";
    if(key === "amount") return money(Number(value));
    if(key === "account_id") return accounts.find(a => a.id === value)?.name ?? "Removed account";
    if(key === "category_id") return categories.find(c => c.id === value)?.name ?? "Removed category";
    if(Array.isArray(value)) return value.length ? `${value.length} tag(s)` : "None";
    return String(value);
  }
  return <ManagerPanel open={open} onOpenChange={setOpen} title="Transaction history" description="Edits recorded since history was enabled. Up to 100 most recent changes." icon={History} trigger={trigger ?? <Button size="icon-sm" variant="ghost" aria-label="View transaction history" title="Edit history"><History className="size-3.5" /></Button>}>
    {error ? <div role="alert">{error}<Button onClick={retry}>Try again</Button></div> : !data ? <p role="status">Loading history…</p> : !data.history.length ? <p className="text-sm text-muted-foreground">No recorded edits. Changes made before history was enabled are not available.</p> : data.history.map(row => <article className="dashboard-panel space-y-3 p-4" key={row.id}><header><h3 className="text-sm font-semibold">{row.actorName || "Workspace member"}</h3><time className="text-xs text-muted-foreground" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time></header><dl className="space-y-2">{Object.keys(labels).filter(key => JSON.stringify(row.before[key]) !== JSON.stringify(row.after[key])).map(key => <div key={key} className="text-sm"><dt className="text-xs text-muted-foreground">{labels[key]}</dt><dd className="break-words"><span className="text-muted-foreground">{display(key,row.before[key])}</span><span aria-label="changed to"> → </span>{display(key,row.after[key])}</dd></div>)}</dl></article>)}
  </ManagerPanel>;
}
