"use client";

import { useActionState, useState } from "react";
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
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  return (
    <>
      <AuthHeading title="Set a new password" sub="Choose a new password for your account." />
      <form action={action} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <div className="grid gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="h-10"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="reset-hint"
            autoFocus
            required
          />
          <p id="reset-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            className="h-10"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            required
          />
        </div>
        {mismatch && <FormError>Passwords don&apos;t match.</FormError>}
        {error && !mismatch && <FormError>{error}</FormError>}
        <Button
          type="submit"
          className="mt-1 h-10 w-full font-semibold"
          disabled={pending || mismatch || tooShort || !password || !confirm}
        >
          {pending ? "Saving…" : "Set password"}
        </Button>
      </form>
    </>
  );
}
