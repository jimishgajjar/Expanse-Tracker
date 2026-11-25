"use client";

import { useId, useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { deletePrivateTracker } from "@/lib/personal-actions";
import { trackerExportHref } from "@/lib/household-access";

export function DeletePrivateTracker({ workspace, name }: { workspace: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const inputId = useId();
  const errorId = useId();

  return <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4" aria-label="Manage private tracker">
    <div className="min-w-0">
      <h2 className="text-sm font-semibold">Manage private tracker</h2>
      <p className="mt-1 text-xs text-muted-foreground">Delete this entire private tracker when you no longer need it.</p>
    </div>
    <Dialog open={open} onOpenChange={value => {
      if (pending) return;
      setOpen(value); setConfirmation(""); setError("");
    }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive" />}>
        <Trash2 className="size-3.5" /> Delete private tracker
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete private tracker?</DialogTitle>
          <DialogDescription>
            Permanently delete <span className="font-medium text-foreground break-words">{name}</span> and all its accounts,
            transactions, transfers, receipts, plans, and shared account reports. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Your shared household, other private trackers, and sign-in account will stay unchanged.</p>
        <a href={trackerExportHref(workspace)} className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-brand underline-offset-4 hover:underline">
          <Download className="size-4" /> Export this tracker first
        </a>
        <form onSubmit={event => {
          event.preventDefault();
          if (pending || confirmation !== name) return;
          setError("");
          start(async () => {
            try {
              const result = await deletePrivateTracker({ workspace, confirmation });
              if (!result.ok) { setError(result.error ?? "Could not delete this tracker."); return; }
              toast.success("Private tracker deleted. Choose a tracker to continue.");
              try { localStorage.setItem("tracker-switch", crypto.randomUUID()); } catch { /* Storage may be disabled. */ }
              window.location.replace("/");
            } catch { setError("Could not confirm deletion. Reload to check before trying again."); }
          });
        }} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={inputId} className="text-xs font-medium">Type <span className="break-words font-semibold">{name}</span> to confirm</label>
            <Input id={inputId} value={confirmation} onChange={event => setConfirmation(event.target.value)}
              disabled={pending} autoComplete="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
            {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending || confirmation !== name}>
              {pending ? "Deleting…" : "Delete private tracker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
