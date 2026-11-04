"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { CommentCursor, CommentPage } from "@/lib/transaction-comments";
import { ManagerPanel } from "./manager-panel";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "./ui/button";
import { DropdownMenuItem } from "./ui/dropdown-menu";

export function TransactionComments({id,label}:{id:string;label:string}) {
  const [open,setOpen] = useState(false);
  return <ManagerPanel open={open} onOpenChange={setOpen} title="Comments" icon={MessageSquare} description={label}
    trigger={<DropdownMenuItem closeOnClick={false} nativeButton render={<button type="button"/>}><MessageSquare/>Comments</DropdownMenuItem>}>
    {open && <Conversation key={id} id={id}/>}
  </ManagerPanel>;
}

export function Conversation({id}:{id:string}) {
  const base = "/api/transaction-comments/" + encodeURIComponent(id);
  const [pages,setPages] = useState<CommentCursor[]>([]);
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState<{url:string; page?:CommentPage; error?:string}>();
  const [draft,setDraft] = useState("");
  const [mentions,setMentions] = useState<string[]>([]);
  const requestId = useRef("");
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState("");
  const cursor = pages.at(-1);
  const url = cursor ? base + "?" + new URLSearchParams({at:cursor.at,before:cursor.id}) : base;
  const page = result?.url === url ? result.page : undefined;

  useEffect(() => {
    let generation = 0;
    let active:AbortController | undefined;
    async function load(conceal:boolean) {
      const current = ++generation;
      active?.abort();
      if (conceal || document.hidden) setResult(undefined);
      if (document.hidden) return;
      const controller = new AbortController();
      active = controller;
      const timeout = window.setTimeout(() => controller.abort(),10000);
      try {
        const response = await fetch(url,{cache:"no-store",signal:controller.signal});
        if (!response.ok) throw Error();
        const page:CommentPage = await response.json();
        if (current === generation) setResult({url,page});
      } catch {
        if (current === generation) setResult({url,error:"Couldn’t verify access to these comments. Reopen the tracker or try again."});
      } finally { window.clearTimeout(timeout); }
    }
    const resume = () => {void load(true);};
    resume();
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("pageshow",resume);
    window.addEventListener("focus",resume);
    const poll = window.setInterval(() => {if (!document.hidden) void load(false);},15000);
    return () => {
      generation++;
      active?.abort();
      document.removeEventListener("visibilitychange",resume);
      window.removeEventListener("pageshow",resume);
      window.removeEventListener("focus",resume);
      window.clearInterval(poll);
    };
  },[url,revision]);

  async function change(comment?:string) {
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const response = comment
        ? await fetch(base+"?"+new URLSearchParams({comment}),{method:"DELETE"})
        : await fetch(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:requestId.current,body:draft,mentions})});
      if (!response.ok) {
        if ([400,401,403,404].includes(response.status)) setRevision(n => n+1);
        const error = await response.json().catch(() => null);
        throw Error(error?.error || "Couldn’t save the change. Try again.");
      }
      if (!comment) {setDraft("");setMentions([]);requestId.current="";setPages([]);}
      setFeedback(comment ? "Comment removed." : "Comment posted.");
      setRevision(n => n+1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Couldn’t save the change. Try again.");
    } finally {setBusy(false);}
  }

  if (!page) return result?.url===url && result.error
    ? <p role="alert">{result.error} <Button size="sm" variant="outline" onClick={()=>setRevision(n=>n+1)}>Try again</Button></p>
    : <p role="status">Loading comments…</p>;
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">{page.personal ? "Only you can see this conversation. Shared account reports exclude comments."
      : "All current members of this tracker can read this conversation."}</p>
    {page.canPost ? <form className="space-y-2" onSubmit={e=>{e.preventDefault();void change();}}>
      <label className="block text-sm font-medium">Add a comment
        <textarea className="mt-1 block min-h-20 w-full resize-y rounded-lg border bg-background p-2.5 text-sm"
          value={draft} maxLength={1000} disabled={busy} onChange={e=>{setDraft(e.target.value); requestId.current="";setFeedback("");}}/>
      </label>
      {!page.personal && (page.targets.length > 0 || mentions.length > 0) && <details className="rounded-lg border px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">Mention household members{mentions.length ? ` (${mentions.length})` : ""}</summary>
        <fieldset disabled={busy} className="mt-2 space-y-1"><legend className="mb-1 text-muted-foreground">Choose up to 10. Each person controls their notifications.</legend>
          {page.targets.map(person => <label key={person.id} className="flex min-h-8 items-center gap-2">
            <input type="checkbox" checked={mentions.includes(person.id)} disabled={!mentions.includes(person.id) && mentions.length >= 10}
              onChange={e=>{setMentions(e.target.checked?[...mentions,person.id]:mentions.filter(id=>id!==person.id));requestId.current="";}}/>
            {person.name}</label>)}
          {mentions.some(id=>!page.targets.some(p=>p.id===id)) && <button type="button" className="underline" onClick={()=>{
            setMentions(mentions.filter(id=>page.targets.some(p=>p.id===id)));requestId.current="";
          }}>Remove unavailable recipients</button>}
        </fieldset>
      </details>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{draft.length} / 1,000</span>
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}>Post comment</Button>
      </div>
    </form> : <p className="text-sm text-muted-foreground">Your access is read-only.</p>}
    <p role="status" className="empty:hidden text-sm">{feedback}</p>
    {page.rows.length ? <section aria-label="Comments, newest first" className="divide-y border-y">
      {page.rows.map(row=><article key={row.id} className="space-y-1 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="break-words text-sm font-semibold">{row.author}</p>
            <time dateTime={row.at} className="text-xs text-muted-foreground">{new Date(row.at).toLocaleString()}</time></div>
          {row.canRemove && <ConfirmDialog title="Remove this comment?" description="Its text will be removed from this conversation."
            confirmLabel="Remove" trigger={<Button size="sm" variant="ghost" disabled={busy}>Remove</Button>}
            onConfirm={()=>change(row.id)}/>}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{row.body}</p>
        {row.mentions.length > 0 && <p className="break-words text-xs text-muted-foreground">Mentioned · {row.mentions.join(", ")}</p>}
      </article>)}
    </section> : <p className="rounded-lg border p-3 text-sm text-muted-foreground">{cursor ? "No older comments on this page." : "No comments yet."}</p>}
    {(cursor || page.next) && <nav aria-label="Comment pages" className="flex justify-between gap-2">
      <Button size="sm" variant="outline" disabled={!cursor || busy} onClick={()=>setPages(p=>p.slice(0,-1))}>Newer comments</Button>
      <Button size="sm" variant="outline" disabled={!page.next || busy} onClick={()=>{if(page.next)setPages([...pages,page.next]);}}>Older comments</Button>
    </nav>}
  </div>;
}
