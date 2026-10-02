"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Coins,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { ImportForm } from "@/components/import-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { NotificationsToggle } from "@/components/notifications-toggle";
import { CURRENCIES, findCurrencyByCode } from "@/lib/currencies";
import { updateSettings } from "@/lib/actions";
import { logout } from "@/lib/auth";

interface SettingsTabProps {
  currencyCode: string;
  userEmail: string;
  workspaceName: string;
  canEdit?: boolean;
}

export function SettingsTab({
  currencyCode,
  userEmail,
  workspaceName,
  canEdit = true,
}: SettingsTabProps) {
  const id = useId();
  const router = useRouter();
  const [code, setCode] = useState(currencyCode);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const activeCurrency = findCurrencyByCode(code) ?? CURRENCIES[0];

  function handleSaveCurrency() {
    setError("");
    start(async () => {
      const res = await updateSettings({ currencyCode: code });
      if (res.ok) {
        toast.success("Display currency saved");
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error || "Failed to update currency");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Grid of Settings Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD 1: DISPLAY & CURRENCY */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Coins className="size-4" />
                </span>
                <h2 className="text-base font-bold text-foreground">
                  Display Currency
                </h2>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Choose the currency symbol and format applied across accounts and ledgers.
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-bold text-brand">
              {activeCurrency.symbol} {activeCurrency.code}
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <Label htmlFor={id} className="text-xs font-semibold">
              Select Currency
            </Label>
            <Select
              disabled={!canEdit}
              value={code}
              onValueChange={(v) => setCode(v as string)}
            >
              <SelectTrigger
                id={id}
                className="h-10 w-full rounded-xl border-border/80 bg-background text-sm font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-block w-8 font-mono font-bold text-brand">
                      {c.symbol}
                    </span>
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {" "}· {c.code}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Changes formatting only. Existing transaction numbers are preserved without conversions.
            </p>
          </div>

          {canEdit && (
            <div className="pt-1">
              <Button
                onClick={handleSaveCurrency}
                disabled={pending || code === currencyCode}
                className="rounded-xl px-4 text-xs font-semibold shadow-xs"
              >
                {pending ? "Saving…" : "Save Currency"}
              </Button>
            </div>
          )}

          <FormError>{error}</FormError>
        </div>

        {/* CARD 2: ACTIVE WORKSPACE & NOTIFICATIONS */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-brand/10 text-brand">
                <Wallet className="size-4" />
              </span>
              <h2 className="text-base font-bold text-foreground">
                Active Workspace
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <span className="text-muted-foreground text-[11px]">Workspace</span>
                <p className="mt-1 font-bold text-foreground truncate">
                  {workspaceName}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <span className="text-muted-foreground text-[11px]">Your Role</span>
                <p className="mt-1 font-bold text-positive capitalize">
                  {canEdit ? "Editor / Manager" : "Viewer"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-brand/10 text-brand">
                <Bell className="size-4" />
              </span>
              <h2 className="text-base font-bold text-foreground">
                Payment Reminders
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Get notified before upcoming bills post and when automated recurring rules execute.
            </p>
            <NotificationsToggle />
          </div>
        </div>

        {/* CARD 3: DATA PORTABILITY & BACKUP */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-brand/10 text-brand">
              <Database className="size-4" />
            </span>
            <h2 className="text-base font-bold text-foreground">
              Data & Backups
            </h2>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <FileSpreadsheet className="size-4 text-brand" /> Full Ledger (.xlsx)
              </span>
              <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                Excel
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Export all accounts, transactions, transfers, categories, and bills to Excel.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-border/80 font-semibold"
              onClick={() => window.location.assign("/api/export")}
            >
              <Download className="mr-1.5 size-4 text-brand" /> Download Backup (.xlsx)
            </Button>
          </div>

          {canEdit && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <span className="text-xs font-semibold text-foreground">
                Import Transactions (CSV or Excel)
              </span>
              <p className="text-[11px] text-muted-foreground">
                Columns: <code>Date</code>, <code>Type</code>, <code>Amount</code>, <code>Category</code>, <code>Account</code>, <code>Note</code>.
              </p>
              <ImportForm />
            </div>
          )}
        </div>

        {/* CARD 4: ACCOUNT CREDENTIALS & SECURITY */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-brand/10 text-brand">
              <ShieldCheck className="size-4" />
            </span>
            <h2 className="text-base font-bold text-foreground">
              Account & Credentials
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 font-bold text-brand">
                <User className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{userEmail}</p>
                <p className="text-[11px] text-muted-foreground">Active Session</p>
              </div>
            </div>
            <form action={logout}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="rounded-xl border-border/80 text-xs font-semibold hover:bg-negative/10 hover:text-negative"
              >
                <LogOut className="mr-1 size-3.5" /> Sign out
              </Button>
            </form>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <KeyRound className="size-3.5 text-brand" />
              <span>Update Password</span>
            </div>
            <ChangePasswordForm />
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
              <ShieldAlert className="size-3.5" />
              <span>Danger Zone</span>
            </div>
            <DeleteAccountForm />
          </div>
        </div>
      </div>
    </div>
  );
}
