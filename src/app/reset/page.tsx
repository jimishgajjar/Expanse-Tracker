import Link from "next/link";
import { ResetForm } from "@/components/reset-form";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="grid min-h-svh place-items-center p-6">
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Invalid reset link. <Link href="/forgot" className="underline">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
