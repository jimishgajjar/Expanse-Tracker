"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Button } from "./ui/button";

export function DensityPreference() {
  useEffect(() => {
    const apply=()=>{document.documentElement.dataset.density=readDensity();};
    apply(); return subscribe(apply);
  }, []);
  return null;
}

function subscribe(update:()=>void) {
  window.addEventListener("storage",update); window.addEventListener("tracker-density",update);
  return ()=>{window.removeEventListener("storage",update);window.removeEventListener("tracker-density",update);};
}
function readDensity() {
  try {return localStorage.getItem("display-density")==="comfortable"?"comfortable":"compact";} catch {return document.documentElement.dataset.density??"compact";}
}
export function DensityControl() {
  const density = useSyncExternalStore(subscribe,readDensity,()=>"compact");
  return <fieldset className="space-y-2"><legend className="text-sm font-medium">Display density</legend><p className="text-xs text-muted-foreground">Applies on this browser. Phone controls keep their full touch targets.</p><div className="flex gap-2">{["compact", "comfortable"].map(value => <Button key={value} type="button" variant={density === value ? "default" : "outline"} aria-pressed={density === value} onClick={() => { document.documentElement.dataset.density = value; try { localStorage.setItem("display-density", value); } catch { /* Preference still applies this session. */ } window.dispatchEvent(new Event("tracker-density")); }}>{value === "compact" ? "Compact" : "Comfortable"}</Button>)}</div></fieldset>;
}
