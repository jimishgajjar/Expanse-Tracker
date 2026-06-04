"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { signup } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SignupForm() {
  const [error, action, pending] = useActionState(signup, undefined);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="size-5" />
        </div>
        <CardTitle className="mt-1 text-lg">Create your account</CardTitle>
        <p className="text-sm text-muted-foreground">Start tracking your money.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Optional" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Have an account? <Link href="/login" className="font-medium text-foreground hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
