"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccountForm() {
  const [error, action, pending] = useActionState(deleteAccount, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-full text-negative" onClick={() => setConfirming(true)}>
        Delete my account…
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
      <p className="text-xs text-muted-foreground">
        Permanently deletes your account and your personal tracker. Data you added to trackers other people own stays. Enter your password to confirm.
      </p>
      <Input name="password" type="password" placeholder="Your password" autoComplete="current-password" required />
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button type="submit" variant="destructive" size="sm" className="flex-1" disabled={pending}>{pending ? "Deleting…" : "Delete forever"}</Button>
      </div>
    </form>
  );
}
