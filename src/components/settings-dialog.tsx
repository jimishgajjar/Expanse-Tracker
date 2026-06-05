"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateSettings } from "@/lib/actions";
import { logout } from "@/lib/auth";
import { ImportForm } from "@/components/import-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { NotificationsToggle } from "@/components/notifications-toggle";
import { CURRENCIES } from "@/lib/currencies";

export function SettingsDialog({
  trigger,
  currencyCode,
  userEmail,
}: {
  trigger: ReactElement;
  currencyCode: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [code, setCode] = useState(currencyCode);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) setCode(currencyCode);
  }

  function save() {
    start(async () => {
      const res = await updateSettings({ currencyCode: code });
      if (res.ok) { toast.success("Settings saved"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    });
  }

  const items = CURRENCIES.map((c) => ({ value: c.code, label: `${c.label} (${c.symbol})` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
        <div className="grid gap-1.5">
          <Label>Currency</Label>
          <Select value={code} onValueChange={(v) => setCode(v as string)} items={items}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="inline-block w-8 font-mono">{c.symbol}</span>
                  {c.label}
                  <span className="text-muted-foreground"> · {c.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Sets the symbol and number grouping used across the app.</p>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Data</Label>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => window.location.assign("/api/export")}>
            Export to Excel
          </Button>
          <ImportForm />
          <p className="text-xs text-muted-foreground">Import expects the same columns as Export (Date, Type, Amount, Category, Account, Note).</p>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Notifications</Label>
          <NotificationsToggle />
          <p className="text-xs text-muted-foreground">Get a reminder before a recurring payment posts, and a confirmation when it does — by email and on this device. Turn alerts on per rule in the Recurring panel.</p>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Account</Label>
          <p className="text-xs text-muted-foreground">Signed in as <span className="font-medium text-foreground">{userEmail}</span></p>
          <ChangePasswordForm />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">Sign out</Button>
          </form>
          <DeleteAccountForm />
        </div>
        <DialogFooter className="mt-2">
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
