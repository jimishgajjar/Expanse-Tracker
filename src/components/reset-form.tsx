"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { resetPassword } from "@/lib/reset";
import { AuthHeading } from "@/components/auth-heading";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(resetPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  return (
    <div className="w-full space-y-6">
      <AuthHeading title="Set a new password" sub="Choose a strong, new password for your account." />
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">
            New password
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="h-11 rounded-xl border-border/80 bg-muted/30 pl-10 pr-10 text-sm transition-all hover:bg-muted/50 focus-visible:border-brand focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/20 shadow-2xs"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="reset-hint"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <p id="reset-hint" className="text-[11px] text-muted-foreground">
            Minimum 8 characters.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-xs font-semibold text-foreground/90">
            Confirm new password
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden
            />
            <Input
              id="confirm"
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="h-11 rounded-xl border-border/80 bg-muted/30 pl-10 pr-3 text-sm transition-all hover:bg-muted/50 focus-visible:border-brand focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/20 shadow-2xs"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              required
            />
          </div>
        </div>

        {mismatch && <FormError>Passwords don&apos;t match.</FormError>}
        {error && !mismatch && <FormError>{error}</FormError>}

        <Button
          type="submit"
          className="group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-white font-semibold shadow-xs hover:bg-brand-deep hover:shadow-md active:scale-[0.99] transition-all"
          disabled={pending || mismatch || tooShort || !password || !confirm}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Saving password…</span>
            </>
          ) : (
            <>
              <span>Set new password</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Back to{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
