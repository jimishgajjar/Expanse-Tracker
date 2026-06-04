"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MailWarning, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendVerification } from "@/lib/auth";

export function VerifyBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();
  if (dismissed) return null;

  function resend() {
    start(async () => {
      const res = await resendVerification();
      if (res.ok) toast.success("Verification email sent — check your inbox.");
      else toast.error(res.error ?? "Couldn't send the email.");
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
      <MailWarning className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="min-w-0 flex-1">
        Confirm your email (<span className="font-medium">{email}</span>) to unlock shared trackers.
      </p>
      <Button size="sm" variant="outline" onClick={resend} disabled={pending}>Resend</Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setDismissed(true)} aria-label="Dismiss"><X className="size-3.5" /></Button>
    </div>
  );
}
