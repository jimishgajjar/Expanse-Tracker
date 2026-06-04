"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/reset";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ForgotForm() {
  const [result, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Reset password</CardTitle>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a reset link.</p>
      </CardHeader>
      <CardContent>
        {result === "sent" ? (
          <div className="space-y-3 text-sm">
            <p>If an account exists for that email, a reset link is on its way.</p>
            <p className="text-xs text-muted-foreground">No email provider configured? The link is printed in the server console.</p>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Back to sign in</Link>
          </div>
        ) : (
          <form action={action} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" autoFocus required />
            </div>
            <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
            <p className="text-center text-sm text-muted-foreground"><Link href="/login" className="hover:underline">Back to sign in</Link></p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
