import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/verify";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const res = await verifyEmailToken(token ?? "");

  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        {res.ok ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-positive" />
            <h1 className="mt-3 text-lg font-semibold">Email verified</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your address is confirmed
              {res.joined ? ` — and you've joined ${res.joined} shared tracker${res.joined > 1 ? "s" : ""}` : ""}.
            </p>
            <Button render={<Link href="/" />} className="mt-4 w-full">Go to your tracker</Button>
          </>
        ) : (
          <>
            <XCircle className="mx-auto size-10 text-negative" />
            <h1 className="mt-3 text-lg font-semibold">Verification failed</h1>
            <p className="mt-1 text-sm text-muted-foreground">{res.error}</p>
            <Button render={<Link href="/" />} variant="outline" className="mt-4 w-full">Back to the app</Button>
          </>
        )}
      </div>
    </div>
  );
}
