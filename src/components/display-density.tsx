"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export function DensityPreference() {
  useEffect(() => {
    try { document.documentElement.dataset.density = localStorage.getItem("display-density") === "comfortable" ? "comfortable" : "compact"; } catch { /* Storage can be unavailable. */ }
  }, []);
  return null;
}

export function DensityControl() {
  const [density, setDensity] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.density === "comfortable" ? "comfortable" : "compact");
  return <fieldset className="space-y-2"><legend className="text-sm font-medium">Display density</legend><p className="text-xs text-muted-foreground">Applies on this browser. Phone controls keep their full touch targets.</p><div className="flex gap-2">{["compact", "comfortable"].map(value => <Button key={value} type="button" variant={density === value ? "default" : "outline"} aria-pressed={density === value} onClick={() => { setDensity(value); document.documentElement.dataset.density = value; try { localStorage.setItem("display-density", value); } catch { /* Preference still applies this session. */ } }}>{value === "compact" ? "Compact" : "Comfortable"}</Button>)}</div></fieldset>;
}
