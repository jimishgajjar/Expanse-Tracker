"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
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
        <div className="grid size-10 place-items-center rounded-xl bg-muted">
          <Lock className="size-5" />
        </div>
        <CardTitle className="mt-1 text-lg">Money Tracker</CardTitle>
        <p className="text-sm text-muted-foreground">Enter your password to continue.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="next" value={next} />
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" name="password" autoFocus required />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Unlock"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
