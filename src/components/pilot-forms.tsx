"use client";
import { useActionState,useState } from "react";
import type { ReactNode } from "react";
import { pilotAction,type PilotResult } from "@/lib/pilot-actions";
import { CURRENCIES } from "@/lib/currencies";
import type { setupProgress } from "@/lib/pilot-setup";
type State=Awaited<ReturnType<typeof setupProgress>>;
const field="min-h-11 rounded-lg border bg-background px-3";
const button="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-60";
function Field({label,children}:{label:string;children:ReactNode}) {return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;}
function Result({value}:{value:PilotResult|null}) {return <p role="status" aria-live="polite" className="text-sm">{value?.message}</p>;}
export function Preferences({workspace,data}:{workspace:string;data:State}) {
  const [result,submit,pending]=useActionState(pilotAction.bind(null,workspace),null);
  return <form action={submit} className="grid gap-3"><input type="hidden" name="action" value="preferences"/>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Display currency"><select name="currency" defaultValue={data.currency} className={field}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select></Field>
    <Field label="Household time zone"><input name="timezone" defaultValue={data.timezone??"UTC"} placeholder="America/Toronto" required className={field}/></Field></div>
    <p className="text-xs text-muted-foreground">Currency sets the display format. The time zone sets today’s date on Overview.</p>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="bills" defaultChecked={data.bills_skipped}/>Skip recurring bills for now</label>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="invite" defaultChecked={data.invite_skipped}/>Set up without a partner</label>
    <div><button disabled={pending} className={button}>Save household preferences</button></div><Result value={result}/></form>;
}

function History({workspace,account,date}:{workspace:string;account:string;date:string}) {
  const [preview,check,checking]=useActionState(pilotAction.bind(null,workspace),null);
  const [saved,confirm,saving]=useActionState(pilotAction.bind(null,workspace),null);
  const identifiers=<><input type="hidden" name="account" value={account}/><input type="hidden" name="date" value={date}/></>;
  return <><form action={check}>{identifiers}<button name="action" value="preview" disabled={checking || !date} className={button}>Preview recorded history</button><Result value={preview}/></form>
    {preview?.opening && <div className="space-y-2"><p role="status">Opening amount {preview.opening.opening}. Through {date}, {preview.opening.count} entries bring the recorded balance to <strong>{preview.opening.balance}</strong>.</p>
    {preview.opening.cutoff?<p>Statement cutoff saved through {preview.opening.cutoff}.</p>:<form className="grid gap-2" action={confirm}>{identifiers}
      <Field label="Closing balance from your statement"><input required name="statement" inputMode="decimal" className={field}/></Field>
      <p className="text-xs text-muted-foreground">Confirming sets the last date already covered by this opening statement. Older file entries can then only be matched or ignored.</p>
      <div><button name="action" value="confirm" disabled={saving || saved?.ok} className={button}>Confirm matching statement</button></div><Result value={saved}/></form>}</div>}</>;
}
export function OpeningForm({workspace,accounts}:{workspace:string;accounts:State["accounts"]}) {
  const [account,setAccount]=useState(accounts[0]?.id??"");
  const [date,setDate]=useState("");
  return <div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2">
    <Field label="Account"><select className={field} value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
    <Field label="Statement closing date"><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className={field}/></Field></div>
    <History key={account+":"+date} workspace={workspace} account={account} date={date}/></div>;
}
export function FeedbackForm({workspace}:{workspace:string}) {
  const [result,submit,pending]=useActionState(pilotAction.bind(null,workspace),null);
  return <form action={submit} className="grid gap-4"><input type="hidden" name="action" value="feedback"/>
    <Field label="What happened?"><select name="severity" className={field}><option value="blocked">A task is blocked</option><option value="financial">An amount looks wrong</option><option value="privacy">Privacy or access issue</option><option value="suggestion">Suggestion</option></select></Field>
    <Field label="Steps and expected result"><textarea name="message" minLength={5} maxLength={800} required rows={4} className={field}/></Field>
    <p className="text-sm text-muted-foreground">Leave out names, balances, bank details and passwords. Your report is linked to your login for follow-up.</p>
    <div><button disabled={pending} className={button}>Send feedback</button></div><Result value={result}/></form>;
}
