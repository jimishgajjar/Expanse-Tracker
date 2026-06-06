"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, undefined);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="size-5" />
        </div>
        <CardTitle className="mt-1 text-lg">Welcome back</CardTitle>
        <p className="text-sm text-muted-foreground">Sign in to your Expense Tracker.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="next" value={next} />
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" autoFocus required />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            No account? <Link href="/signup" className="font-medium text-foreground hover:underline">Sign up</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
