"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createTag, listTags } from "@/lib/actions";
import type { TagRef } from "@/lib/queries";

export function TagInput({ id, value, onChange, onPendingChange }: { id?: string; value: TagRef[]; onChange: (tags: TagRef[]) => void; onPendingChange?: (pending: boolean) => void }) {
  const [all, setAll] = useState<TagRef[]>([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { listTags().then(setAll).catch(() => {}); }, []);

  const selectedIds = new Set(value.map((t) => t.id));
  const q = query.trim().toLowerCase();
  const suggestions = all.filter((t) => !selectedIds.has(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const exact = all.find((t) => t.name.toLowerCase() === q);

  function add(tag: TagRef) { if (!selectedIds.has(tag.id)) onChange([...value, tag]); setQuery(""); }
  function remove(id: string) { onChange(value.filter((t) => t.id !== id)); }
  async function create() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    onPendingChange?.(true);
    setError("");
    try {
      const res = await createTag({ name });
      if (res.ok && res.data) {
        const t = res.data;
        setAll((a) => (a.some((x) => x.id === t.id) ? a : [...a, t]));
        add(t);
      } else if (!res.ok) setError(res.error);
    } catch { setError("Could not create the tag. Please try again."); }
    finally { setCreating(false); onPendingChange?.(false); }
  }

  return (
    <div className="relative" onFocus={() => setFocused(true)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-transparent p-1.5">
        {value.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
            {t.name}
            <button type="button" onClick={() => remove(t.id)} aria-label={`Remove ${t.name}`} className="grid size-8 place-items-center opacity-70 hover:opacity-100"><X className="size-3" /></button>
          </span>
        ))}
        <input
          id={id}
          aria-label="Tags"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q) { e.preventDefault(); if (exact) add(exact); else create(); }
            if (e.key === "Backspace" && !query && value.length) remove(value[value.length - 1].id);
          }}
          placeholder={value.length ? "" : "Add tags…"}
          className="min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
      {focused && (q.length > 0 || suggestions.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
          {suggestions.map((t) => (
            <button key={t.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </button>
          ))}
          {q.length > 0 && !exact && (
            <button type="button" disabled={creating} onMouseDown={(e) => e.preventDefault()} onClick={create} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50">
              <Plus className="size-3.5 shrink-0" /> Create &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
