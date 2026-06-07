"use client";

import { useActionState, useState } from "react";
import { resetPassword } from "@/lib/reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(resetPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

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
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} required />
          </div>
          {tooShort && <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>}
          {mismatch && <p className="text-sm text-negative">Passwords don&apos;t match.</p>}
          {error && !mismatch && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={pending || mismatch || tooShort || !password || !confirm}>
            {pending ? "Saving…" : "Set password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
