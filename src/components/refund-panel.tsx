"use client";
import {useState,type ReactElement} from "react";
import {Undo2} from "lucide-react";
import {useRouter} from "next/navigation";
import {reviewRefund,saveRefund,removeRefund} from "@/lib/monthly-planning-actions";
import {useFormat,useSettings} from "./settings-provider";
import {ManagerPanel} from "./manager-panel";
import {Button} from "./ui/button";
import {Input} from "./ui/input";

type Review=Extract<Awaited<ReturnType<typeof reviewRefund>>,{ok:true}>["value"];
export function RefundPanel({credit,trigger}:{credit:string;trigger:ReactElement}){
  const {workspace}=useSettings(), {money}=useFormat(), router=useRouter();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [review,setReview]=useState<Review|null>(null),[search,setSearch]=useState(""),[selected,setSelected]=useState("");
  const [amounts,setAmounts]=useState<string[]>([]);
  async function run(work:()=>Promise<void>){
    setBusy(true);setError("");
    try{await work();}catch(e){setError(e instanceof Error?e.message:"Couldn’t open the refund. Try again.");}
    finally{setBusy(false);}
  }
  async function load(query:string,purchase=""){
    if(!workspace)throw Error("Reopen your workspace.");
    const result=await reviewRefund(workspace,credit,query,purchase);
    if(!result.ok)throw Error(result.error);
    const data=result.value;
    setReview(data);setSelected(purchase);
    const available=data.choices.filter(c=>Number(c.remaining)>0);
    setAmounts(data.choices.map(c=>available.length===1&&Number(c.remaining)>=Number(data.incoming.amount)?data.incoming.amount:""));
  }
  async function change(){
    if(!workspace||!review)return;
    const result=review.link?await removeRefund(workspace,credit,review.link.id):
      await saveRefund(workspace,{credit,purchase:selected,purchaseDate:review.purchases[0]?.date,purchaseAmount:review.purchases[0]?.amount,
        creditDate:review.incoming.date,creditAmount:review.incoming.amount,
        portions:review.choices.flatMap((c,i)=>Number(amounts[i])>0?[{categoryId:c.categoryId,amount:amounts[i]}]:[])});
    if(!result.ok)throw Error(result.error);
    await load(search);router.refresh();window.dispatchEvent(new Event("ledger-changed"));
  }
  const original=review?.purchases[0];
  return <ManagerPanel title="Refund link" description="Apply a recorded credit to the categories of its original purchase." icon={Undo2} trigger={trigger}
    open={open} onOpenChange={v=>{setOpen(v);if(v){setSearch("");setReview(null);void run(()=>load(""));}}}>
    <div className="space-y-3 text-sm" aria-busy={busy}>
      {busy&&<p role="status">Loading…</p>}
      {error&&<p role="alert" className="text-negative">{error} <button className="underline" disabled={busy} onClick={()=>void run(()=>load(search))}>Reload</button></p>}
      {review&&<>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Incoming credit · {review.incoming.date}</p>
          <strong>{money(Number(review.incoming.amount))}</strong> · {review.incoming.note||review.incoming.account}</div>
        {review.link&&original?<><p>Linked to <strong>{original.note||"Purchase"}</strong> · {original.account} · {original.date}</p>
          {review.link.portions.map(line=><p key={line.categoryId??""}>{review.choices.find(c=>c.categoryId===line.categoryId)?.name??"Uncategorized"} · {money(Number(line.amount))}</p>)}
          <Button variant="outline" disabled={busy} onClick={()=>void run(change)}>Unlink refund</Button>
        </>:selected&&original?<><p><strong>{original.note||"Purchase"}</strong> · {original.date} · {original.account} · {money(Number(original.amount))}</p>
          <p>Assign the credit to the categories of the items returned.</p>
          {review.choices.map((line,i)=><label key={line.categoryId??""} className="block">{line.name} · {money(Number(line.remaining))} available
            <Input type="number" step="0.01" min="0" max={line.remaining} disabled={busy||Number(line.remaining)<=0} value={amounts[i]??""}
              onChange={e=>setAmounts(amounts.map((v,j)=>i===j?e.target.value:v))}/></label>)}
          <div className="flex gap-2"><Button disabled={busy||!amounts.some(v=>Number(v)>0)} onClick={()=>void run(change)}>Link refund</Button>
            <Button variant="outline" disabled={busy} onClick={()=>void run(()=>load(search))}>Choose another purchase</Button></div>
        </>:<><form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run(()=>load(search));}}>
          <Input aria-label="Search purchases" placeholder="Note, account, amount or date" value={search} onChange={e=>setSearch(e.target.value)}/>
          <Button type="submit" variant="outline" disabled={busy}>Search</Button></form>
          <p className="text-xs text-muted-foreground">Up to 50 purchases on or before the credit date. Search to find older purchases.</p>
          {review.purchases.map(p=><button type="button" key={p.id} disabled={busy} className="flex w-full items-center justify-between gap-3 border-b py-2 text-left hover:bg-muted"
            onClick={()=>void run(()=>load(search,p.id))}><span>{p.note||"Purchase"}<small className="block text-muted-foreground">{p.date} · {p.account}</small></span><strong>{money(Number(p.amount))}</strong></button>)}
          {!review.purchases.length&&<p>No matching purchases.</p>}</>}
        <p className="text-xs text-muted-foreground">Budgets apply the refund on the credit date. Both original account entries stay in Activity.</p>
      </>}
    </div>
  </ManagerPanel>;
}
