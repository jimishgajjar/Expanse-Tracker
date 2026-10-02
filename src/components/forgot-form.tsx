"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/reset";
import { AuthHeading } from "@/components/auth-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ForgotForm() {
  const [result, action, pending] = useActionState(requestPasswordReset, undefined);

  if (result === "sent") {
    return (
      <div className="w-full space-y-5">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
          <MailCheck className="size-6" />
        </span>
        <AuthHeading title="Check your inbox" sub="If an account exists for that email, a reset link is on its way." />
        <p className="text-xs leading-relaxed text-muted-foreground">
          No email provider configured? The reset link is printed in the server console.
        </p>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full rounded-xl font-semibold")}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <AuthHeading title="Reset your password" sub="Enter your email and we'll send you a link to set a new one." />
      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-foreground/90">
            Email address
          </Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              className="h-11 rounded-xl border-border/80 bg-muted/30 pl-10 pr-3 text-sm transition-all hover:bg-muted/50 focus-visible:border-brand focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/20 shadow-2xs"
              autoFocus
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-white font-semibold shadow-xs hover:bg-brand-deep hover:shadow-md active:scale-[0.99] transition-all"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Sending link…</span>
            </>
          ) : (
            <>
              <span>Send reset link</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Remembered your password?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
