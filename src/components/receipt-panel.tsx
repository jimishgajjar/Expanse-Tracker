"use client";
import {useState,type ReactElement} from "react";
import Image from "next/image";
import {Paperclip} from "lucide-react";
import {ManagerPanel} from "./manager-panel";
import {Button} from "./ui/button";

type Info={id:string;bytes:number;download:string};
export function ReceiptPanel({transactionId,canEdit,trigger}:{transactionId:string;canEdit:boolean;trigger:ReactElement}){
  const url="/api/receipts/"+encodeURIComponent(transactionId);
  const [open,setOpen]=useState(false),[receipt,setReceipt]=useState<Info|null>(null);
  const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[confirm,setConfirm]=useState(false);
  async function request(path:string,options?:RequestInit){
    const response=await fetch(path,{...options,cache:"no-store"});
    const body=await response.json();if(!response.ok)throw Error(body.error||"Receipt unavailable.");return body;
  }
  async function refresh(){
    const body=await request(url);setReceipt(body.receipt);setLoaded(true);
  }
  async function run(task:()=>Promise<void>){
    setBusy(true);setConfirm(false);setError("");
    try{await task();}catch(e){setError(e instanceof Error?e.message:"Couldn’t load receipt.");}
    finally{setBusy(false);}
  }
  return <ManagerPanel title="Receipt" description="A private copy for members of this workspace." icon={Paperclip} trigger={trigger}
    open={open} onOpenChange={v=>{setOpen(v);if(v){setLoaded(false);void run(refresh);}}}>
    {busy&&<p role="status">Working…</p>}{error&&<p role="alert">{error} <button disabled={busy} onClick={()=>void run(refresh)}>Refresh</button></p>}
    {loaded&&<div className="space-y-3">
      {receipt?<><Image src={receipt.download+"&view=1"} alt="Attached receipt" unoptimized width={480} height={640}
        className="max-h-96 w-full rounded-lg border object-contain" onError={()=>setError("Preview unavailable. Refresh to request a new link.")}/>
        <p className="text-sm">Receipt photo · {Math.ceil(receipt.bytes/1024)} KB</p>
        <Button disabled={busy} onClick={()=>void run(async()=>{
          const {receipt:fresh}=await request(url);if(!fresh||fresh.id!==receipt.id){await refresh();return;}
          const a=document.createElement("a");a.href=fresh.download;a.download="receipt.jpg";a.click();
        })}>Download receipt</Button>
        {canEdit&&(confirm?<div><p className="text-sm">Remove the saved photo from this transaction?</p>
          <Button disabled={busy} onClick={()=>void run(async()=>{await request(url+"?file="+encodeURIComponent(receipt.id),{method:"DELETE"});await refresh();})}>Remove photo</Button>
          <Button variant="ghost" onClick={()=>setConfirm(false)}>Keep photo</Button></div>:
          <Button variant="ghost" disabled={busy} onClick={()=>setConfirm(true)}>Remove receipt</Button>)}
      </>:<><p className="text-sm">No receipt attached.</p>
        {canEdit&&<label className="block text-sm font-medium">Attach a receipt photo
          <input type="file" accept="image/jpeg,image/png" disabled={busy} className="mt-2 block w-full rounded-lg border p-2" onChange={e=>{
            const file=e.target.files?.[0];e.target.value="";if(!file)return;
            if(file.size>5*1024*1024){setError("Choose a photo up to 5 MB.");return;}
            void run(async()=>{await request(url,{method:"POST",headers:{"Content-Type":file.type},body:file});await refresh();});
          }}/><span className="mt-1 block text-xs font-normal text-muted-foreground">JPEG or PNG, up to 5 MB. Saved as a JPEG copy.</span>
        </label>}</>}
    </div>}
  </ManagerPanel>;
}
