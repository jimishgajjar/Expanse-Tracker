"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon";
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions";
import type { CategoryDTO } from "@/lib/queries";

type Kind = "income" | "expense";

export function CategoryManager({ trigger, categories }: { trigger: ReactElement; categories: CategoryDTO[] }) {
  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Categories</SheetTitle>
          <SheetDescription>Organise income &amp; expenses — each gets its own icon and colour.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="expense" className="min-h-0 flex-1 p-4">
          <TabsList className="w-full">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
          {(["expense", "income"] as Kind[]).map((kind) => {
            const list = categories.filter((c) => c.kind === kind);
            return (
              <TabsContent key={kind} value={kind} className="mt-3 space-y-3">
                <AddCategoryForm kind={kind} />
                <div className="max-h-[calc(100dvh-19rem)] space-y-1.5 overflow-y-auto pr-1">
                  {list.map((c) => <CategoryRow key={c.id} category={c} />)}
                  {list.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">No {kind} categories yet.</p>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function AddCategoryForm({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(kind === "income" ? "trending-up" : "tag");
  const [color, setColor] = useState(kind === "income" ? "#10b981" : "#64748b");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const res = await createCategory({ name, kind, icon, color });
      if (res.ok) { toast.success("Category added"); setName(""); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={add} className="space-y-2.5 rounded-lg border p-2.5">
      <div className="flex gap-2">
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${kind} category`} />
        <Button type="submit" size="icon" disabled={pending} aria-label="Add category">
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

  function save() {
    start(async () => {
      const res = await updateCategory(category.id, { name, icon, color });
      if (res.ok) { toast.success("Category updated"); setEditing(false); router.refresh(); }
      else toast.error(res.error);
    });
  }
  function cancel() {
    setName(category.name); setIcon(category.icon); setColor(category.color); setEditing(false);
  }
  async function remove() {
    const res = await deleteCategory(category.id);
    if (res.ok) { toast.success("Category deleted"); router.refresh(); }
    else toast.error(res.error);
  }

  if (editing) {
    return (
      <div className="space-y-2.5 rounded-lg border p-2.5">
        <div className="flex gap-2">
          <IconPicker value={icon} color={color} onChange={setIcon} />
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="icon" variant="ghost" onClick={save} disabled={pending} aria-label="Save"><Check className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={cancel} aria-label="Cancel"><X className="size-4" /></Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
      <span className="grid size-8 place-items-center rounded-md" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
        <Icon name={category.icon} size={16} />
      </span>
      <span className="flex-1 truncate text-sm font-medium">{category.name}</span>
      <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit"><Pencil className="size-3.5" /></Button>
      <ConfirmDialog
        trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="size-3.5" /></Button>}
        title={`Delete "${category.name}"?`}
        description="Transactions keep their history but become uncategorised."
        onConfirm={remove}
      />
    </div>
  );
}
