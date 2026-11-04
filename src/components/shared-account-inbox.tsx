"use client";
import { useEffect, useRef, useState } from "react";
import type { AccountReport, InboxShare } from "@/lib/account-share-store";
import { AccountShareReport } from "./account-share-report";
import { Button } from "./ui/button";

type Detail = { report:AccountReport; revision:string };
type Inbox = { list:InboxShare[]; detail:Detail|null };
export function SharedAccountInbox() {
  const [selected,setSelected] = useState("");
  const [attempt,setAttempt] = useState(0);
  const [inbox,setInbox] = useState<Inbox|null>(null);
  const [message,setMessage] = useState("");
  const shown = useRef<Detail|null>(null);
  useEffect(()=>{
    let generation = 0;
    let active: AbortController | undefined;
    function clear() { shown.current=null; setInbox(null); }
    async function check(reset:boolean) {
      const current = ++generation;
      active?.abort();
      if (reset || document.hidden) clear();
      if (document.hidden) return;
      const controller = new AbortController();
      active = controller;
      const timer = window.setTimeout(()=>controller.abort(),8000);
      try {
        const query = new URLSearchParams({share:selected,v:shown.current?.revision??""});
        const response = await fetch("/api/account-shares?"+query,{cache:"no-store",signal:controller.signal});
        if (!response.ok) throw Error();
        const result:Inbox = await response.json();
        if (generation!==current) return;
        const item = result.list.find(i=>i.id===selected);
        const detail = result.detail ?? shown.current;
        shown.current = item && detail?.revision===item.revision ? detail : null;
        setInbox({list:result.list,detail:shown.current});
        setMessage(selected && !item ? "This copy is no longer shared with you." : "");
      } catch {
        if (generation===current) { clear(); setMessage("Could not verify your access. Please try again."); }
      } finally { window.clearTimeout(timer); }
    }
    const resume = ()=>{void check(true);};
    void check(true);
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("focus",resume);
    window.addEventListener("pageshow",resume);
    const poll=window.setInterval(()=>{if (!document.hidden) void check(false);},15000);
    return ()=>{ generation++;active?.abort();window.clearInterval(poll);document.removeEventListener("visibilitychange",resume);
      window.removeEventListener("focus",resume);window.removeEventListener("pageshow",resume); };
  },[selected,attempt]);
  function select(id:string) { shown.current=null;setInbox(null);setMessage("");setSelected(id); }
  return <section className="space-y-3">
    <h1 className="text-xl font-semibold">Accounts shared with me</h1>
    <p className="text-sm text-muted-foreground">These copies show the activity their owners approved. Household balances count only accounts in the household tracker.</p>
    {message && <p role="status" className="text-sm">{message} <button className="text-brand underline" onClick={()=>setAttempt(n=>n+1)}>Refresh</button></p>}
    {!inbox && !message && <p role="status" className="text-sm">Checking access…</p>}
    {inbox && !inbox.list.length && <p className="rounded-xl border p-4 text-sm">No household members have shared an account with you.</p>}
    {inbox?.list.map(item=><Button key={item.id} size="sm" variant={selected===item.id?"secondary":"outline"} className="mr-2" onClick={()=>select(selected===item.id?"":item.id)} aria-expanded={selected===item.id}>
      {item.name} · {item.owner}</Button>)}
    {inbox?.detail && <><p className="text-xs text-muted-foreground">Shared {new Date(inbox.list.find(i=>i.id===selected)!.date).toLocaleString()}</p>
      <AccountShareReport key={inbox.detail.revision} report={inbox.detail.report} photoUrl={r=>"/api/account-shares?"+new URLSearchParams({share:selected,photo:r.photo!,v:inbox.detail!.revision})}/>
    </>}
  </section>;
}
