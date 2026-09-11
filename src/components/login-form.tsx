"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/lib/auth";
import { AuthHeading } from "@/components/auth-heading";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, undefined);
  return (
    <>
      <AuthHeading
        title="Welcome back"
        sub={
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-brand underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        }
      />
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" className="h-10" autoFocus required />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-10"
            required
          />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" className="mt-1 h-10 w-full font-semibold" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
