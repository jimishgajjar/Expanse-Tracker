"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X, Tags, Search } from "lucide-react";
import { ManagerPanel, PanelCreate } from "./manager-panel";
import Link from "next/link";
import { ToolEmpty, ToolPage, ToolSection } from "./tool-page";
import { useFormat } from "./settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon";
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions";
import { RECOMMENDED_CATEGORY_PRESETS, getColorCombo } from "@/lib/colors";
import type { CategoryDTO } from "@/lib/queries";

type Kind = "income" | "expense";

export type CategoryUsage = Record<string, { count: number; total: number }>;

export function CategoryManager({
  trigger,
  categories,
  usage,
  usageLabel,
}: {
  trigger: ReactElement;
  categories: CategoryDTO[];
  /** Entries and total per category for the selected period, when the page has them. */
  usage?: CategoryUsage;
  usageLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const { money } = useFormat();
  const list = categories.filter((c) => c.kind === kind);
  const q = search.trim().toLocaleLowerCase();
  const matches = list.filter((c) => c.name.toLocaleLowerCase().includes(q));
  const presets = RECOMMENDED_CATEGORY_PRESETS.filter(
    (p) => p.kind === kind && !list.some((existing) => existing.name.toLowerCase() === p.name.toLowerCase()),
  );
  const count = (k: Kind) => categories.filter((c) => c.kind === k).length;
  const used = usage ? list.filter((c) => usage[c.id]?.count).length : 0;
  const noun = kind === "expense" ? "spending" : "income";

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="segmented" role="group" aria-label="Category type">
        {(["expense", "income"] as Kind[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "expense" ? "Spending" : "Income"}
            <span className="ml-1.5 text-muted-foreground">{count(k)}</span>
          </button>
        ))}
      </div>
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Find a category" placeholder="Find a category" value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="pl-9" />
      </div>
    </div>
  );

  return (
    <ManagerPanel
      trigger={trigger}
      title="Categories"
      icon={Tags}
      description="Organise your income and spending. Choose names, icons, and colours that are easy to recognise."
    >
      <ToolPage
        main={
          <div className="space-y-4">
            {toolbar}
            {list.length === 0 ? (
              <ToolEmpty title={`No ${noun} categories yet`}>
                Add one with the form, or pick a suggestion to start.
              </ToolEmpty>
            ) : (
              <ToolSection
                title={q ? `${matches.length} of ${list.length} categories` : `${list.length} ${noun} categories`}
                meta={usage && usageLabel ? `${used} used in ${usageLabel}` : undefined}
              >
                {matches.map((c) => (
                  <CategoryRow key={c.id} category={c} usage={usage?.[c.id]} usageLabel={usageLabel} money={money} />
                ))}
                {matches.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No category matches that search.</p>}
              </ToolSection>
            )}
          </div>
        }
        aside={
          <PanelCreate key={kind} title={`Add a ${noun} category`} defaultOpen={list.length === 0}>
            <AddCategoryForm kind={kind} presets={presets} />
          </PanelCreate>
        }
      />
    </ManagerPanel>
  );
}

function AddCategoryForm({
  kind,
  presets,
}: {
  kind: Kind;
  presets: readonly { name: string; icon: string; color: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(kind === "income" ? "trending-up" : "tag");
  const [color, setColor] = useState(kind === "income" ? "#10b981" : "#0ea5e9");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const res = await createCategory({ name, kind, icon, color });
      if (res.ok) {
        toast.success("Category added");
        setName("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function applyPreset(p: { name: string; icon: string; color: string }) {
    setName(p.name);
    setIcon(p.icon);
    setColor(p.color);
  }

  return (
    <form onSubmit={add} className="space-y-4 rounded-xl border border-border bg-card p-4">
      {presets.length > 0 && (
        <div className="space-y-1.5 pb-2 border-b border-border/60">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <span>Suggestions</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {presets.slice(0, 5).map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="group flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-[11px] font-medium text-foreground transition-all hover:border-brand/40 hover:bg-muted active:scale-95"
              >
                <span
                  className="grid size-4 place-items-center rounded"
                  style={{ backgroundColor: `${p.color}25`, color: p.color }}
                >
                  <Icon name={p.icon} size={11} />
                </span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <Input
          aria-label="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="h-10 rounded-xl"
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || !name.trim()}
          aria-label="Add category"
          className="size-10 shrink-0 rounded-xl bg-brand text-brand-foreground shadow-2xs hover:bg-brand/90"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <ColorPicker value={color} onChange={setColor} />
    </form>
  );
}

function CategoryRow({ category, usage, usageLabel, money }: { category: CategoryDTO; usage?: { count: number; total: number }; usageLabel?: string; money: (n: number) => string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);
  const combo = getColorCombo(category.color);

  function save() {
    start(async () => {
      const res = await updateCategory(category.id, { name, icon, color });
      if (res.ok) {
        toast.success("Category updated");
        setEditing(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function cancel() {
    setName(category.name);
    setIcon(category.icon);
    setColor(category.color);
    setEditing(false);
  }
  async function remove() {
    const res = await deleteCategory(category.id);
    if (res.ok) {
      toast.success("Category deleted");
      router.refresh();
    } else toast.error(res.error);
  }

  if (editing) {
    return (
      <div className="space-y-4 bg-muted/30 p-4">
        <div className="flex flex-wrap gap-2">
          <IconPicker value={icon} color={color} onChange={setIcon} />
          <Input aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 min-w-40 flex-1" />
          <Button onClick={save} disabled={pending || !name.trim()} className="h-10 bg-brand text-brand-foreground hover:bg-brand/90">
            <Check className="size-4" /> Save
          </Button>
          <Button variant="ghost" onClick={cancel} className="h-10">
            <X className="size-4" /> Cancel
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg border"
        style={{ backgroundColor: combo.background, borderColor: combo.border, color: combo.text }}
      >
        <Icon name={category.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/categories/${category.id}`} className="break-words text-sm font-medium text-foreground underline-offset-4 hover:underline">
          {category.name}
        </Link>
        {usageLabel && usage?.count ? (
          <p className="text-xs text-muted-foreground">{usage.count} {usage.count === 1 ? "entry" : "entries"} in {usageLabel}</p>
        ) : null}
      </div>
      {usage?.count ? <span className="amount shrink-0 text-sm font-medium">{money(usage.total)}</span> : null}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${category.name}`} className="size-8 rounded-lg text-muted-foreground hover:text-foreground">
          <Pencil className="size-3.5" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="icon" variant="ghost" aria-label={`Delete ${category.name}`} className="size-8 rounded-lg text-muted-foreground hover:bg-negative/10 hover:text-negative">
              <Trash2 className="size-3.5" />
            </Button>
          }
          title={`Delete "${category.name}"?`}
          description="Transactions keep their history but become uncategorised."
          onConfirm={remove}
        />
      </div>
    </div>
  );
}
