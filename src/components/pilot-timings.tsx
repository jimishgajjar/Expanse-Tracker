"use client";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback,useState,useSyncExternalStore } from "react";
type Sample={id:string;device:"mobile"|"desktop";metric:"LCP"|"INP"|"CLS";value:number};
const key="pilot-page-timings";
const event="pilot-timing-change";
function view(){return document.querySelector<HTMLElement>("[data-tracker-view]")?.dataset.trackerView;}
function current(){
  try{const data=JSON.parse(sessionStorage.getItem(key)??"null") as {scope:string;samples:Sample[]}|null;
    return data && data.scope===view() && Array.isArray(data.samples)?data:null;
  }catch{return null;}
}
function listen(update:()=>void){window.addEventListener(event,update);return ()=>window.removeEventListener(event,update);}
function active(){return !!current();}
function Observer(){
  const report=useCallback<Parameters<typeof useReportWebVitals>[0]>(metric=>{
    if(metric.name!=="LCP" && metric.name!=="INP" && metric.name!=="CLS") return;
    const saved=current();
    if(!saved || !Number.isFinite(metric.value)) return;
    const samples=saved.samples.filter(s=>s.id!==metric.id);
    samples.push({id:metric.id,device:matchMedia("(max-width: 767px)").matches?"mobile":"desktop",metric:metric.name,value:metric.value});
    try{sessionStorage.setItem(key,JSON.stringify({...saved,samples:samples.slice(-90)}));}catch{/* Optional tab storage. */}
  },[]);
  useReportWebVitals(report);
  return null;
}
export function PilotTimingCollector(){const on=useSyncExternalStore(listen,active,()=>false);return on?<Observer/>:null;}
export function PilotTimingControls(){
  const on=useSyncExternalStore(listen,active,()=>false);
  const [readout,setReadout]=useState("");
  const toggle=()=>{
    try{
      if(on) sessionStorage.removeItem(key);
      else if(view()) sessionStorage.setItem(key,JSON.stringify({scope:view(),samples:[]}));
      setReadout("");window.dispatchEvent(new Event(event));
    }catch{setReadout("This browser does not allow local timing storage.");}
  };
  function read(){
    const metrics={desktop:{LCP:[] as number[],INP:[] as number[],CLS:[] as number[]},mobile:{LCP:[] as number[],INP:[] as number[],CLS:[] as number[]}};
    for(const s of current()?.samples??[]) metrics[s.device][s.metric].push(s.value);
    setReadout(JSON.stringify(metrics,null,2));
  }
  return <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">Optional pilot page timings</summary>
    <p>With your consent, this tab keeps up to 90 timing samples for this sign-in and tracker. To measure, enable timing, reload, and use the app. You choose whether to share the values with the pilot operator.</p>
    <button type="button" aria-pressed={on} onClick={toggle} className="min-h-11 text-brand underline">{on?"Stop and clear samples":"Enable timing for this tab"}</button>
    {on && <button type="button" onClick={read} className="ml-4 min-h-11 text-brand underline">Show timing values</button>}
    {readout && <label className="grid">Timing results<textarea readOnly rows={5} value={readout} className="rounded border p-2 font-mono"/></label>}</details>;
}
