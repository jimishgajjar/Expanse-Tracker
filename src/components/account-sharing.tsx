"use client";
import { useState } from "react";
import type { previewAccountShare, sharingOptions } from "@/lib/account-share-store";
import { Button } from "./ui/button";
import { AccountShareReport } from "./account-share-report";

type Options = Awaited<ReturnType<typeof sharingOptions>>;
type Preview = Awaited<ReturnType<typeof previewAccountShare>>;
const endpoint = "/api/account-shares";
async function request<T>(url: string, data?: object): Promise<T> {
  const res = await fetch(url, { cache:"no-store", ...(data && {method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}) });
  const result = await res.json();
  if (!res.ok) throw Error(result.error ?? "Sharing is unavailable.");
  return result;
}

export function AccountSharing({account,initial}:{account:string;initial:Options}) {
  const [options,setOptions] = useState(initial);
  const [recipient,setRecipient] = useState("");
  const [photos,setPhotos] = useState(false);
  const [preview,setPreview] = useState<Preview|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const person = options.recipients.find(r=>r.id===recipient);
  async function submit(action:"preview"|"confirm"|"stop") {
    if (busy || !person) return;
    setBusy(true); setMessage("");
    try {
      const choice = {action,account,recipient,photos};
      if (action === "preview") {
        setPreview(await request<Preview>(endpoint,choice));
      } else {
        if (action==="confirm" && !preview) return;
        await request(endpoint,action === "confirm" ? {...choice,token:preview!.token,expires:preview!.expires} : {...choice,revision:person.revision});
        setPreview(null);
        setMessage(action === "confirm" ? "This member can now open the reviewed copy from household Accounts." : "Sharing stopped. This member can no longer open the copy.");
        setOptions(await request<Options>(endpoint+"?"+new URLSearchParams({account})));
      }
    } catch (error) {
      setPreview(null); setMessage(error instanceof Error ? error.message : "Please review again.");
      try { setOptions(await request<Options>(endpoint+"?"+new URLSearchParams({account}))); } catch { /* Reopening the tracker rechecks access. */ }
    } finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <div><p className="text-xs text-muted-foreground">{options.household}</p><h1 className="text-xl font-semibold">Share {options.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Share a read-only copy with one household member. Future activity stays private until you approve another copy.</p></div>
    <section className="grid gap-3 rounded-xl border bg-card p-4">
      <label className="grid gap-1 text-sm font-medium">Household member
        <select disabled={busy} value={recipient} onChange={e=>{setRecipient(e.target.value);setPreview(null);setMessage("");setPhotos(false);}} className="rounded-lg border bg-background p-2">
          <option value="">Choose a member</option>
          {options.recipients.map(r=><option key={r.id} value={r.id}>{r.name ? r.name+" · " : ""}{r.email}{r.shared ? " · Shared" : ""}</option>)}
        </select>
      </label>
      {!options.recipients.length && <p className="text-sm text-muted-foreground">There are no other current members in this household.</p>}
      {person && options.canShare && <><label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={busy} checked={photos} onChange={e=>{setPhotos(e.target.checked);setPreview(null);setMessage("");}}/> Include receipt photos
      </label><p className="text-xs text-muted-foreground">The copy includes dates, amounts, notes and category names. Transfers show their amount and direction. Other account names, transfer notes and edit history stay private.</p></>}
      {person && <div className="flex flex-wrap gap-2">
        {options.canShare && <Button size="sm" disabled={busy} onClick={()=>submit("preview")}>{person.shared?"Preview updated copy":"Preview what they’ll see"}</Button>}
        {person.shared && <Button size="sm" variant="outline" disabled={busy} onClick={()=>submit("stop")}>Stop sharing with this member</Button>}
      </div>}
    </section>
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    {preview && <><div className="rounded-xl border border-brand/30 p-4">
      <h2 className="text-sm font-semibold">Preview for {preview.audience.name || preview.audience.email}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{preview.audience.email} · {preview.audience.household}</p>
    </div>
      <AccountShareReport key={preview.token} report={preview.report} photoUrl={r=>endpoint+"?"+new URLSearchParams({account,photo:r.photo!,v:r.fingerprint!})}/>
      <p className="text-xs text-muted-foreground">Stopping sharing closes access in the tracker. The recipient can keep anything they already saved.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={()=>submit("confirm")}>Confirm and share this copy</Button>
        <Button disabled={busy} variant="ghost" onClick={()=>setPreview(null)}>Cancel preview</Button>
      </div>
    </>}
  </div>;
}
