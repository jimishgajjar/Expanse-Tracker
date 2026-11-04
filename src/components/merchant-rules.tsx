"use client";

import {useEffect,useState} from "react";
import {currentRules,matchingAlias,normalizeMerchant,type RuleRevision} from "@/lib/merchant-rule-model";
import type {RuleBook} from "@/lib/merchant-rule-store";
import type {CategoryDTO,TagRef} from "@/lib/queries";
import {loadMerchantRules,saveMerchantRule} from "@/lib/merchant-rule-actions";
import {Button} from "./ui/button";

const field="mt-1 block w-full rounded-lg border bg-background p-2 text-sm";
type Props={
  accountId:string; kind:"income"|"expense"; note:string; categories:CategoryDTO[];
  selectedCategory:string|null; selectedTags:TagRef[]; apply:(category:string|null,tags:TagRef[])=>void;
};
export default function MerchantRules({accountId,kind,note,categories,selectedCategory,selectedTags,apply}:Props){
  const [book,setBook]=useState<RuleBook|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<RuleRevision|null>(null),[aliasText,setAliasText]=useState(""),[preview,setPreview]=useState(false);
  const [reload,setReload]=useState(0),[message,setMessage]=useState("");
  useEffect(()=>{
    let current=true;
    loadMerchantRules({accountId,kind}).then(result=>{if(current){setBook(result);setError("");}})
      .catch(()=>{if(current)setError("Couldn’t load rules for this account.");});
    return ()=>{current=false;};
  },[accountId,kind,reload]);
  function edit(rule:RuleRevision){
    setDraft(rule);setAliasText(rule.aliases.join("\n"));setPreview(false);setError("");setMessage("");
  }
  if(error&&!book)return <p role="alert">{error} <button type="button" onClick={()=>setReload(r=>r+1)}>Retry</button></p>;
  if(!book)return <p role="status">Loading merchant rules…</p>;
  const rules=currentRules(book.history);
  const matches=rules.filter(r=>r.enabled&&matchingAlias(r,note));
  const categoryName=(id:string|null)=>categories.find(c=>c.id===id)?.name;
  const outcomes=(r:RuleRevision)=>[r.categoryId?categoryName(r.categoryId)??"Removed category":null,
    ...r.tagIds.map(id=>book.tags.find(t=>t.id===id)?.name??"Removed tag")].filter(Boolean).join(" · ");
  const complete=(r:RuleRevision)=>(!r.categoryId||!!categoryName(r.categoryId))&&r.tagIds.every(id=>book.tags.some(t=>t.id===id));
  function update(data:Partial<RuleRevision>){setDraft(r=>r&&({...r,...data}));setPreview(false);setError("");}
  const aliases=aliasText.split("\n").map(a=>a.trim()).filter(Boolean);
  const proposed=draft&&{...draft,name:draft.name.trim(),aliases};
  const sample=proposed?book.notes.filter(n=>matchingAlias(proposed,n)):[];
  async function save(){
    if(!proposed||!preview||busy)return;
    setBusy(true);setError("");
    try{
      const {id,version,...definition}=proposed;
      if(!await saveMerchantRule({accountId,kind,id,base:version,definition})){
        setDraft(null);setReload(r=>r+1);setMessage("This rule or its references changed. Check the latest version before editing.");return;
      }
      const fresh=await loadMerchantRules({accountId,kind});
      setBook(fresh);setDraft(null);setMessage("Rule saved.");
    }catch{setError("Couldn’t confirm the save. Close and reopen rules to check the saved version.");}
    finally{setBusy(false);}
  }
  return <section className="space-y-3 rounded-lg border bg-muted/25 p-3 text-xs" onKeyDown={event=>{
    // The editor lives inside the transaction form. Enter in a rule field must not post the transaction.
    if(event.key==="Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
  }}>
    <p className="text-muted-foreground">Rules for this account’s {kind==="expense"?"expenses":"income"}. Suggestions apply to this draft when you choose one.</p>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
    {matches.length>1&&<p>{matches.length} rules match. Highest priority is listed first. Choose the one you intended.</p>}
    {matches.map(r=><div key={r.id} className="space-y-1 border-b pb-2">
      <strong>{r.name}</strong> · matched “{matchingAlias(r,note)}” · priority {r.priority}
      <p>{outcomes(r)}</p>
      <Button type="button" size="sm" variant="outline" disabled={!complete(r)||busy} onClick={()=>{
        apply(selectedCategory??r.categoryId,book.tags.filter(t=>r.tagIds.includes(t.id)));
        setMessage("Suggestion applied to this draft.");
      }}>Apply suggestion</Button>
      {selectedCategory&&r.categoryId&&selectedCategory!==r.categoryId&&<p>Your selected category will be kept.</p>}
    </div>)}
    {!matches.length&&note.trim()&&<p>No saved rule matches this note.</p>}
    {rules.length>0&&<details><summary className="cursor-pointer font-medium">Manage rules ({rules.length})</summary>
      {rules.map(r=><div key={r.id} className="flex items-center justify-between gap-2 border-b py-1.5">
        <span>{r.name} · {r.enabled?"Active":"Paused"} · v{r.version}</span>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>edit(r)}>Edit</Button>
      </div>)}</details>}
    {!draft?<Button type="button" size="sm" variant="outline" onClick={()=>edit({
      id:crypto.randomUUID(),version:0,name:note.slice(0,80),aliases:[],categoryId:selectedCategory,tagIds:selectedTags.map(t=>t.id),priority:50,enabled:true,
    })}>New merchant rule</Button>:<fieldset disabled={busy} className="space-y-2">
      <legend className="font-semibold">{draft.version?"Edit merchant rule":"New merchant rule"}</legend>
      <label className="block">Merchant name<input className={field} maxLength={80} value={draft.name} onChange={e=>update({name:e.target.value})}/></label>
      <label className="block">Other names on statements (one per line)<textarea className={field} rows={2} value={aliasText} onChange={e=>{setAliasText(e.target.value);setPreview(false);}}/></label>
      <div className="grid grid-cols-2 gap-2"><label>Suggested category<select className={field} value={draft.categoryId??""} onChange={e=>update({categoryId:e.target.value||null})}>
        <option value="">Tags only</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Priority (0–100)<input className={field} type="number" min={0} max={100} value={draft.priority} onChange={e=>update({priority:Number(e.target.value)})}/></label></div>
      {!!book.tags.length&&<fieldset><legend>Suggested tags</legend><div className="flex flex-wrap gap-2">{book.tags.map(t=><label key={t.id}>
        <input type="checkbox" checked={draft.tagIds.includes(t.id)} onChange={e=>update({tagIds:e.target.checked?[...draft.tagIds,t.id]:draft.tagIds.filter(id=>id!==t.id)})}/> {t.name}
      </label>)}</div></fieldset>}
      <label className="block"><input type="checkbox" checked={draft.enabled} onChange={e=>update({enabled:e.target.checked})}/> Rule active</label>
      {draft.version>0&&<details><summary className="cursor-pointer">Version history</summary>
        {book.history.filter(r=>r.id===draft.id).map(r=><p key={r.version} className="py-1">v{r.version} · {r.name} · {r.enabled?"Active":"Paused"} · priority {r.priority} · {outcomes(r)}{r.aliases.length?" · "+r.aliases.join(", "):""}</p>)}</details>}
      {preview&&proposed&&<div role="status" className="rounded-md border bg-background p-2">
        <strong>{proposed.enabled?"Preview":"Paused rule"} · {outcomes(proposed)}</strong>
        {proposed.enabled?<><p>{matchingAlias(proposed,note)?"Matches the current draft.":"Doesn’t match the current draft."} Matches {sample.length} of the {book.notes.length} most recent notes.</p>
          {sample.length>0&&<p>Examples: {[...new Set(sample)].slice(0,3).join(" · ")}</p>}</>:<p>This rule will stop making suggestions.</p>}
      </div>}
      <div className="flex gap-2"><Button type="button" size="sm" disabled={busy} onClick={()=>{
        if(preview){void save();return;}
        if(normalizeMerchant(draft.name).length<2||aliases.length>12||aliases.some(a=>a.length>80||normalizeMerchant(a).length<2)
          ||(!draft.categoryId&&!draft.tagIds.length)||draft.tagIds.length>12||!Number.isInteger(draft.priority)||draft.priority<0||draft.priority>100||(draft.enabled&&!complete(draft))){
          setError("Check the merchant name, aliases (up to 12), priority, and choose an available category or tag.");return;
        }
        setError("");setPreview(true);
      }}>{preview?"Save rule":"Preview rule"}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={()=>setDraft(null)}>Cancel rule</Button></div>
    </fieldset>}
  </section>;
}
