"use client";

import Link from "next/link";
import Script from "next/script";
import {useEffect,useRef,useState} from "react";
import {bankCommand,type Command} from "@/app/bank-inbox/actions";
import type {InboxView} from "@/lib/plaid-sandbox/inbox";
import {Button} from "./ui/button";
import {BankEntryReview} from "./bank-entry-review";
import type {ReviewOptions} from "@/lib/plaid-sandbox/reviews";

type Handler={open:()=>void;destroy:()=>void};
type SDK={create:(opts:{token:string;onSuccess:(token:string)=>void;onExit:(error:unknown)=>void})=>Handler};
export function BankInboxPanel({workspace,initial,initialOptions}:{workspace:string;initial:InboxView;initialOptions:ReviewOptions|null}){
  const [options,setOptions]=useState(initialOptions),[editing,setEditing]=useState("");
  const [view,setView]=useState(initial),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  const [ready,setReady]=useState(false),[choice,setChoice]=useState(""),[confirm,setConfirm]=useState(false),[page,setPage]=useState(0);
  const handler=useRef<Handler|null>(null),lock=useRef(false);
  useEffect(()=>()=>{handler.current?.destroy();handler.current=null;},[]);
  async function action(cmd:Command){
    const r=await bankCommand(workspace,cmd);
    if(!r.ok)throw Error(r.error);
    if("view" in r){setView(r.view??null);setOptions(r.options??null);setEditing("");setChoice("");if(cmd.op!=="decide")setPage(0);setConfirm(false);}
    return r;
  }
  async function run(cmd:Command,success:string){
    if(lock.current)return; lock.current=true;setBusy(true);setMsg("");
    try{await action(cmd);setMsg(success);}catch(e){setMsg(e instanceof Error?e.message:"Please refresh the inbox.");}
    finally{lock.current=false;setBusy(false);}
  }
  async function connect(repairId?:string){
    if(lock.current)return;lock.current=true;setBusy(true);setMsg("");
    let intent:string|undefined;
    try{
      const sdk=(window as Window&{Plaid?:SDK}).Plaid;if(!sdk)throw Error("Plaid Link has not loaded. Reload this page.");
      const r=await action(repairId?{op:"repair",id:repairId}:{op:"begin"});if(!r.link)throw Error("No Link session available.");
      const {id,linkToken}=r.link;intent=id;
      let ended=false;
      async function finish(cmd:Command,text:string){
        if(ended)return;ended=true;
        try{await action(cmd);setMsg(text);}
        catch(e){setMsg(e instanceof Error?e.message:"Refresh to check connection status.");try{await action({op:"refresh"});}catch{}}
        finally{handler.current?.destroy();handler.current=null;lock.current=false;setBusy(false);}
      }
      handler.current=sdk.create({token:linkToken,
        onSuccess:token=>void finish(repairId?{op:"refresh"}:{op:"exchange",id,token},repairId?"Sign-in updated. Sync to check the existing connection.":"Choose the one account you want to observe."),
        onExit:error=>void finish(repairId?{op:"refresh"}:{op:"cancel",id},error?"Link closed before setup finished.":repairId?"Sign-in repair cancelled.":"Connection cancelled. No account was linked.")});
      handler.current.open();
    }catch(e){
      if(intent&&!repairId)try{await action({op:"cancel",id:intent});}catch{}
      setMsg(e instanceof Error?e.message:"Could not open Link.");lock.current=false;setBusy(false);
    }
  }
  const account=view?.accounts.find(a=>a.id===view.selected);
  const receipts=new Map(options?.receipts.map(r=>[r.id,r]));
  return <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
    <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="afterInteractive" onReady={()=>setReady(true)}
      onError={()=>setMsg("Plaid Link could not load. Check your connection and reload.")}/>
    <Link href="/?tab=accounts" className="text-sm text-brand">← Accounts</Link>
    <header><p className="text-xs font-semibold text-brand">Plaid Sandbox · test data only</p><h1 className="text-2xl font-semibold">Bank inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">Review payments from one test account. Confirm an import to add it to your local tracker.</p></header>
    {msg&&<p role="status" className="rounded-lg border p-3 text-sm">{msg}</p>}
    <section className="dashboard-panel space-y-3 p-4">
      {!view?<><h2 className="font-semibold">Connect a test bank</h2><p className="text-sm">Use a Sandbox institution and test credentials only. Choose one account after returning from Plaid.</p>
        <Button disabled={!ready||busy} onClick={()=>void connect()}>Connect bank</Button></>:
      view.phase==="link"?<><h2 className="font-semibold">Unfinished Link session</h2><p className="text-sm">No connection token has been exchanged.</p>
        <Button disabled={busy} onClick={()=>void run({op:"cancel",id:view.id},"Setup cancelled.")}>Cancel setup</Button></>:
      view.phase==="exchange"?<><h2 className="font-semibold">Connection not yet confirmed</h2><p className="text-sm">Refresh to check again. If still unresolved after a minute, check Plaid Sandbox for an orphaned test Item before clearing this attempt.</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>I checked Plaid Sandbox and removed any leftover test Item.</label>
        <Button disabled={!confirm||busy} onClick={()=>void run({op:"clearUnconfirmed",id:view.id,checked:true},"Unconfirmed local attempt cleared.")}>Clear unconfirmed attempt</Button></>:
      view.phase==="pick"?<><h2 className="font-semibold">Choose one account</h2><p className="text-sm">Only the selected account will be synced. No transactions have been fetched.</p>
        <label className="block text-xs">Sandbox account<select className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm" value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Select an account</option>{view.accounts.map((a,i)=><option key={a.id} value={a.id}>{a.label} · {i+1}</option>)}</select></label>
        <Button disabled={busy||!choice} onClick={()=>void run({op:"select",id:view.id,account:choice},"Account selected. Sync when ready.")}>Use this account</Button>
        <Button variant="ghost" disabled={busy} onClick={()=>void run({op:"accounts",id:view.id},"Account list refreshed.")}>Refresh accounts</Button></>:
      view.phase==="disconnect"?<p>Disconnect pending. Retry to confirm removal with Plaid.</p>:
      <><h2 className="font-semibold">{account?.label??"Selected account"}</h2><p className="text-xs text-muted-foreground">{view.synced?"Last successful sync: "+view.synced.slice(0,16).replace("T"," ")+" UTC":"Not synced yet"} · {view.records.length} entries</p>
        <Button disabled={busy} onClick={()=>void run({op:"sync",id:view.id},"Bank inbox synced.")}>Sync transactions</Button>
        <Button variant="ghost" disabled={busy||!ready} onClick={()=>void connect(view.id)}>Repair sign-in</Button></>}
      {view&&["active","pick","disconnect"].includes(view.phase)&&<div className="border-t pt-3">{confirm?<><p className="mb-2 text-sm">Revoke this Sandbox connection and clear its local inbox? Your tracker entries stay unchanged.</p>
        <Button disabled={busy} onClick={()=>void run({op:"disconnect",id:view.id},"Disconnected. The local bank inbox has been cleared.")}>Confirm disconnect</Button>
        <Button variant="ghost" disabled={busy} onClick={()=>setConfirm(false)}>Keep connection</Button></>:<Button variant="ghost" disabled={busy} onClick={()=>setConfirm(true)}>Disconnect</Button>}</div>}
      <Button variant="ghost" disabled={busy} onClick={()=>void run({op:"refresh"},"Saved state refreshed.")}>Refresh saved state</Button>
      {busy&&<span role="status" className="text-xs">Working…</span>}
    </section>
    {view?.phase==="active"&&<section className="dashboard-panel p-4"><h2 className="font-semibold">Transaction review</h2>
      {!view.records.length?<p className="mt-2 text-sm text-muted-foreground">No observed transactions yet.</p>:<ul className="mt-2 divide-y">{view.records.slice(page*25,(page+1)*25).map(t=>{
        const receipt=receipts.get(t.id);
        return <li key={t.id} className="py-2 text-sm"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{t.label}</p><p className="text-xs text-muted-foreground">{t.date} · {t.pending?"Pending":"Posted"}</p></div>
          <span className="ml-auto text-right tabular-nums">{t.amount<0?"In":"Out"} · {t.currency??"Unknown currency"} {Math.abs(t.amount)}</span>
          {receipt?<span className="text-xs font-medium">{{match:"Matched",import:"Imported",ignore:"Ignored"}[receipt.decision]}{receipt.version!==t.version?" · Bank details changed":""}</span>:
            !t.pending&&options&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>setEditing(editing===t.id?"":t.id)}>Review</Button>}</div>
          {editing===t.id&&options&&!receipt&&<BankEntryReview row={t} connection={view.id} options={options} busy={busy} close={()=>setEditing("")}
            preview={async cmd=>{const r=await action(cmd);if(!r.preview)throw Error("Preview unavailable.");return r.preview;}}
            save={cmd=>run(cmd,{match:"Matched to the existing payment.",ignore:"Entry ignored.",import:"Entry imported into your local tracker."}[cmd.decision.kind])}/>}
        </li>;})}</ul>}
      {view.records.length>25&&<div className="flex items-center gap-3 pt-3 text-xs"><Button size="sm" variant="ghost" disabled={!page} onClick={()=>setPage(page-1)}>Previous</Button>Page {page+1} of {Math.ceil(view.records.length/25)}<Button size="sm" variant="ghost" disabled={(page+1)*25>=view.records.length} onClick={()=>setPage(page+1)}>Next</Button></div>}
    </section>}
  </main>;
}
