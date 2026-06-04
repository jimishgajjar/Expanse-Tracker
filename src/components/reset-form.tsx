"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(resetPassword, undefined);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Set a new password</CardTitle>
        <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="token" value={token} />
          <div className="grid gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} autoFocus required />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Set password"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
