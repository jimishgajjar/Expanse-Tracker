"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { ManagerPanel, PanelSection } from "./manager-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormError } from "./form-error";
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
  canEdit = true,
}: {
  trigger: ReactElement;
  currencyCode: string;
  userEmail: string;
  canEdit?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [code, setCode] = useState(currencyCode);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setCode(currencyCode);
      setError("");
    }
  }

  function save() {
    setError("");
    start(async () => {
      const res = await updateSettings({ currencyCode: code });
      if (res.ok) {
        toast.success("Currency saved");
        router.refresh();
      } else setError(res.error);
    });
  }

  const items = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.label} (${c.symbol})`,
  }));

  return (
    <ManagerPanel
      trigger={trigger}
      title="Settings"
      description="Manage display preferences, data, and your account."
      icon={Settings}
      open={open}
      onOpenChange={onOpenChange}
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        Each section saves separately. Closing settings does not undo completed
        actions.
      </p>
      <PanelSection title="Display & currency">
        <div className="grid gap-1.5">
          <Label htmlFor={id}>Display currency</Label>
          <Select
            disabled={!canEdit}
            value={code}
            onValueChange={(v) => setCode(v as string)}
            items={items}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
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
          <p className="text-xs text-muted-foreground">
            Changes display formatting only. Existing amounts are not converted.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={save}
            disabled={pending || code === currencyCode}
            className="justify-self-start"
          >
            {pending ? "Saving…" : "Save currency"}
          </Button>
        )}
        <FormError>{error}</FormError>
      </PanelSection>
      <PanelSection title="Data">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.location.assign("/api/export")}
        >
          Export to Excel
        </Button>
        {canEdit && <ImportForm />}
        <p className="text-xs text-muted-foreground">
          Import expects the same columns as Export (Date, Type, Amount,
          Category, Account, Note).
        </p>
      </PanelSection>
      <PanelSection title="Notifications">
        <NotificationsToggle />
        <p className="text-xs text-muted-foreground">
          Get a reminder before a recurring payment posts, and a confirmation
          when it does — by email and on this device. Turn alerts on per rule in
          the Recurring panel.
        </p>
      </PanelSection>
      <PanelSection title="Account & security">
        <p className="text-xs text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{userEmail}</span>
        </p>
        <ChangePasswordForm />
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
          >
            Sign out
          </Button>
        </form>
        <DeleteAccountForm />
      </PanelSection>
    </ManagerPanel>
  );
}
