"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailActivity, DetailStat } from "@/components/detail-activity";
import { useFormat } from "@/components/settings-provider";
import { deleteTag, renameTag } from "@/lib/actions";
import type {
  AccountDTO,
  CategoryDTO,
  TagDTO,
  TransactionDTO,
} from "@/lib/queries";

export function TagDetailView({
  tag,
  transactions,
  accounts,
  categories,
  canEdit,
}: {
  tag: TagDTO;
  transactions: TransactionDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
}) {
  const { money } = useFormat();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = name.trim();
    if (!next || next === tag.name) {
      setEditing(false);
      setName(tag.name);
      return;
    }
    setBusy(true);
    const res = await renameTag(tag.id, { name: next });
    setBusy(false);
    if (res.ok) {
      toast.success("Tag renamed");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove() {
    const res = await deleteTag(tag.id);
    if (res.ok) {
      toast.success("Tag deleted");
      router.push("/");
    } else {
      toast.error(res.error);
    }
  }

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const total = transactions.length;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Input
                aria-label="Tag name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={40}
                className="min-h-11 max-w-[16rem]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setName(tag.name);
                  }
                }}
              />
              <Button
                size="icon"
                onClick={save}
                disabled={busy}
                aria-label="Save tag name"
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setName(tag.name);
                }}
                aria-label="Cancel"
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <h1
                className="mr-auto break-words text-3xl font-semibold tracking-tight"
                style={{ color: tag.color }}
              >
                # {tag.name}
              </h1>
              {canEdit && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setName(tag.name);
                      setEditing(true);
                    }}
                    aria-label="Rename tag"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete tag"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Delete tag?"
                    description={`"${tag.name}" will be removed from all ${total} transaction${total === 1 ? "" : "s"}. The transactions are kept.`}
                    onConfirm={remove}
                  />
                </>
              )}
            </>
          )}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-6 border-t pt-5 sm:grid-cols-3">
          <DetailStat
            label="Total income · all time"
            value={money(income)}
            tone="text-positive"
          />
          <DetailStat
            label="Total expenses · all time"
            value={money(expense)}
            tone="text-negative"
          />
          <DetailStat label="Transactions" value={String(total)} />
        </dl>
      </div>
      <DetailActivity
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        canEdit={canEdit}
      />
    </div>
  );
}
