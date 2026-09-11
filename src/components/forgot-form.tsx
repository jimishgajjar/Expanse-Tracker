"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
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
      <>
        <span className="mb-5 grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
          <MailCheck className="size-5" />
        </span>
        <AuthHeading title="Check your inbox" sub="If an account exists for that email, a reset link is on its way." />
        <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
          No email provider configured? The link is printed in the server console.
        </p>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-10 w-full")}>
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" sub="Enter your email and we'll send you a link to set a new one." />
      <form action={action} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" className="h-10" autoFocus required />
        </div>
        <Button type="submit" className="mt-1 h-10 w-full font-semibold" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline-offset-4 hover:text-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  );
}
