"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X, Tags, Search } from "lucide-react";
import { ManagerPanel, PanelCreate } from "./manager-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function CategoryManager({
  trigger,
  categories,
}: {
  trigger: ReactElement;
  categories: CategoryDTO[];
}) {
  const [search, setSearch] = useState("");
  return (
    <ManagerPanel
      trigger={trigger}
      title="Categories"
      icon={Tags}
      description="Organise your income and spending. Choose names, icons, and colours that are easy to recognise."
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Find a category" placeholder="Find a category…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="pl-9" />
      </div>
      <Tabs defaultValue="expense" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        {(["expense", "income"] as Kind[]).map((kind) => {
          const list = categories.filter((c) => c.kind === kind);
          const matches = list.filter((c) =>
            c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
          );
          const presets = RECOMMENDED_CATEGORY_PRESETS.filter(
            (p) => p.kind === kind && !list.some((existing) => existing.name.toLowerCase() === p.name.toLowerCase()),
          );

          return (
            <TabsContent key={kind} value={kind} className="space-y-4">
              <PanelCreate
                title={`Add ${kind} category`}
                defaultOpen={list.length === 0}
              >
                <AddCategoryForm kind={kind} presets={presets} />
              </PanelCreate>
              <p className="text-xs font-medium text-muted-foreground">
                {search.trim() ? `${matches.length} of ${list.length}` : list.length} {kind}{" "}
                {list.length === 1 ? "category" : "categories"}
              </p>
              <div className="space-y-2">
                {matches.map((c) => (
                  <CategoryRow key={c.id} category={c} />
                ))}
                {list.length > 0 && matches.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching categories.</p>}
                {list.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No {kind} categories yet.
                  </p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
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
            <span>Suggested categories</span>
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
          placeholder={`New ${kind} category name`}
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

function CategoryRow({ category }: { category: CategoryDTO }) {
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
      <div className="space-y-4 rounded-xl border border-brand/40 bg-card p-3">
        <div className="flex gap-2">
          <IconPicker value={icon} color={color} onChange={setIcon} />
          <Input
            aria-label="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-xl"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={save}
            disabled={pending || !name.trim()}
            aria-label="Save"
            className="size-10 rounded-xl text-positive hover:bg-positive/10"
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={cancel}
            aria-label="Cancel"
            className="size-10 rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg border"
        style={{
          backgroundColor: combo.background,
          borderColor: combo.border,
          color: combo.text,
        }}
      >
        <Icon name={category.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="break-words text-sm font-medium text-foreground">
          {category.name}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${category.name}`}
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${category.name}`}
              className="size-8 rounded-lg text-muted-foreground hover:text-negative hover:bg-negative/10"
            >
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
