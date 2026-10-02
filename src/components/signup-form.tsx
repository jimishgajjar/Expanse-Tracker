"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { signup } from "@/lib/auth";
import { AuthHeading } from "@/components/auth-heading";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [error, action, pending] = useActionState(signup, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full space-y-6">
      <AuthHeading
        title="Create an account"
        sub="Start tracking your money with a calm, private ledger."
      />

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold text-foreground/90">
            Full name <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden
            />
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Jane Doe"
              className="h-11 rounded-xl border-border/80 bg-muted/30 pl-10 pr-3 text-sm transition-all hover:bg-muted/50 focus-visible:border-brand focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/20 shadow-2xs"
              autoFocus
            />
          </div>
        </div>

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
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">
            Password
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
              placeholder="••••••••"
              className="h-11 rounded-xl border-border/80 bg-muted/30 pl-10 pr-10 text-sm transition-all hover:bg-muted/50 focus-visible:border-brand focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/20 shadow-2xs"
              minLength={8}
              aria-describedby="password-hint"
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
          <p id="password-hint" className="text-[11px] text-muted-foreground">
            Minimum 8 characters.
          </p>
        </div>

        <FormError>{error}</FormError>

        <Button
          type="submit"
          className="group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-white font-semibold shadow-xs hover:bg-brand-deep hover:shadow-md active:scale-[0.99] transition-all"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Creating account…</span>
            </>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/70" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-[11px] font-medium text-muted-foreground">
            Already have an account?
          </span>
        </div>
      </div>

      <Link
        href="/login"
        className="flex h-11 w-full items-center justify-center rounded-xl border border-border/80 bg-muted/20 font-medium text-sm text-foreground hover:bg-muted/50 hover:border-border transition-all"
      >
        Sign in to your account
      </Link>

      <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground/75">
        <ShieldCheck className="size-3.5 text-brand shrink-0" />
        <span>Your data remains 100% private and encrypted</span>
      </div>
    </div>
  );
}
