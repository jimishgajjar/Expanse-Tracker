"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadPreference, savePreference } from "@/lib/user-preferences";
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, RotateCcw } from "lucide-react";
import { ManagerPanel } from "./manager-panel";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export const OVERVIEW_SECTIONS = [
  { id: "summary", label: "Balance and cash flow", hint: "Current balance with this period's income and spending" },
  { id: "accounts", label: "Accounts", hint: "Every account with quick income, expense and transfer buttons" },
  { id: "planning", label: "Planning", hint: "Attention inbox, upcoming cash needs, budgets and goals" },
  { id: "activity", label: "Recent activity", hint: "The latest five entries in this period" },
  { id: "charts", label: "Charts", hint: "Income vs expense and spending by category" },
] as const;
export type OverviewSectionId = (typeof OVERVIEW_SECTIONS)[number]["id"];
export type OverviewLayout = { order: OverviewSectionId[]; hidden: OverviewSectionId[] };

const DEFAULT: OverviewLayout = { order: OVERVIEW_SECTIONS.map((s) => s.id), hidden: [] };
const ids = new Set<string>(DEFAULT.order);
// Per person. Kept in this browser for instant loads and synced to the account so the
// same arrangement follows each person to their other devices.
const storageKey = (workspace: string, actor: string) => `overview-layout:${workspace}:${actor}`;
const synced = new Set<string>();
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: OverviewLayout }>();

function parse(raw: string | null): OverviewLayout {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (!data || !Array.isArray(data.order)) return DEFAULT;
    const order = (data.order as string[]).filter((id) => ids.has(id)) as OverviewSectionId[];
    for (const id of DEFAULT.order) if (!order.includes(id)) order.push(id); // sections added later
    const hidden = (Array.isArray(data.hidden) ? data.hidden : []).filter((id: string) => ids.has(id)) as OverviewSectionId[];
    return { order, hidden };
  } catch {
    return DEFAULT;
  }
}
function read(key: string): OverviewLayout {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* Storage blocked: default layout. */ }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value; // stable snapshot for useSyncExternalStore
  const value = parse(raw);
  cache.set(key, { raw, value });
  return value;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => { listeners.delete(fn); window.removeEventListener("storage", fn); };
}

function writeLocal(key: string, raw: string) {
  try { localStorage.setItem(key, raw); } catch { /* Keep the default. */ }
  listeners.forEach((fn) => fn());
}

export function useOverviewLayout(workspace: string, actor: string) {
  const key = storageKey(workspace, actor);
  const layout = useSyncExternalStore(subscribe, () => read(key), () => DEFAULT);
  // Once per page load, adopt the arrangement saved to the account (from another device).
  useEffect(() => {
    if (synced.has(key)) return;
    synced.add(key);
    void loadPreference(key).then((value) => {
      if (!value) return;
      const raw = JSON.stringify(parse(JSON.stringify(value)));
      if (raw !== JSON.stringify(read(key))) writeLocal(key, raw);
    });
  }, [key]);
  function save(next: OverviewLayout) {
    writeLocal(key, JSON.stringify(next));
    void savePreference(key, next);
  }
  return { layout, save, reset: () => save(DEFAULT) };
}

export function CustomiseOverview({ workspace, actor }: { workspace: string; actor: string }) {
  const { layout, save, reset } = useOverviewLayout(workspace, actor);
  const move = (index: number, by: number) => {
    const order = [...layout.order];
    const [item] = order.splice(index, 1);
    order.splice(index + by, 0, item);
    save({ ...layout, order });
  };
  const toggle = (id: OverviewSectionId) =>
    save({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] });
  const visible = layout.order.filter((id) => !layout.hidden.includes(id)).length;
  const changed = JSON.stringify(layout) !== JSON.stringify(DEFAULT);

  return (
    <ManagerPanel
      title="Customise overview"
      icon={LayoutGrid}
      description="Choose which sections you see and in what order. It is saved for you and follows you to your other devices."
      trigger={
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <LayoutGrid className="size-3.5" /> Customise
        </Button>
      }
    >
      <ol className="space-y-2">
        {layout.order.map((id, index) => {
          const section = OVERVIEW_SECTIONS.find((s) => s.id === id)!;
          const hidden = layout.hidden.includes(id);
          return (
            <li key={id} className={cn("flex items-center gap-2 rounded-xl border p-3", hidden && "bg-muted/40")}>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", hidden && "text-muted-foreground line-through")}>{section.label}</p>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Move ${section.label} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Move ${section.label} down`} disabled={index === layout.order.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <Button
                type="button" variant="ghost" size="icon"
                aria-label={hidden ? `Show ${section.label}` : `Hide ${section.label}`}
                aria-pressed={!hidden}
                disabled={!hidden && visible === 1}
                onClick={() => toggle(id)}
              >
                {hidden ? <EyeOff /> : <Eye />}
              </Button>
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="outline" size="sm" className="mt-4 gap-1.5" disabled={!changed} onClick={reset}>
        <RotateCcw className="size-3.5" /> Restore default layout
      </Button>
    </ManagerPanel>
  );
}
