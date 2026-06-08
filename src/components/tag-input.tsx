"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createTag, listTags } from "@/lib/actions";
import type { TagRef } from "@/lib/queries";

export function TagInput({ value, onChange }: { value: TagRef[]; onChange: (tags: TagRef[]) => void }) {
  const [all, setAll] = useState<TagRef[]>([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => { listTags().then(setAll).catch(() => {}); }, []);

  const selectedIds = new Set(value.map((t) => t.id));
  const q = query.trim().toLowerCase();
  const suggestions = all.filter((t) => !selectedIds.has(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const exact = all.find((t) => t.name.toLowerCase() === q);

  function add(tag: TagRef) { if (!selectedIds.has(tag.id)) onChange([...value, tag]); setQuery(""); }
  function remove(id: string) { onChange(value.filter((t) => t.id !== id)); }
  async function create() {
    const name = query.trim();
    if (!name) return;
    const res = await createTag({ name });
    if (res.ok && res.data) {
      const t = res.data;
      setAll((a) => (a.some((x) => x.id === t.id) ? a : [...a, t]));
      add(t);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-transparent p-1.5">
        {value.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
            {t.name}
            <button type="button" onClick={() => remove(t.id)} aria-label={`Remove ${t.name}`} className="opacity-70 hover:opacity-100"><X className="size-3" /></button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
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
            <button key={t.id} type="button" onMouseDown={(e) => { e.preventDefault(); add(t); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </button>
          ))}
          {q.length > 0 && !exact && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); create(); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              <Plus className="size-3.5 shrink-0" /> Create &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
