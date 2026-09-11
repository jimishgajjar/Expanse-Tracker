import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthHeading } from "@/components/auth-heading";
import { ResetForm } from "@/components/reset-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell
      headline="One new password and you're back in."
      sub="Reset links are single-use and expire, so nobody else can walk through the same door."
    >
      {token ? (
        <ResetForm token={token} />
      ) : (
        <>
          <AuthHeading
            title="This link isn't valid"
            sub="Reset links are single-use and expire after a while — this one has already been used or has run out."
          />
          <Link href="/forgot" className={cn(buttonVariants(), "h-10 w-full font-semibold")}>
            Request a new link
          </Link>
        </>
      )}
    </AuthShell>
  );
}
