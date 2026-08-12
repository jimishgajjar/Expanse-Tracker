"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/lib/auth";
import { AuthHeading } from "@/components/auth-shell";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [error, action, pending] = useActionState(signup, undefined);
  return (
    <>
      <AuthHeading
        title="Create your account"
        sub={
          <>
            Already have one?{" "}
            <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        }
      />
      <form action={action} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="name">
            Name <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="name" name="name" autoComplete="name" className="h-10" autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" className="h-10" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="h-10"
            minLength={8}
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" className="mt-1 h-10 w-full font-semibold" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Your tracker starts private. Nothing is shared until you invite someone.
        </p>
      </form>
    </>
  );
}
