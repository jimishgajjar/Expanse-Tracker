"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { importTransactions } from "@/lib/import-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ImportForm() {
  const router = useRouter();
  const [result, action, pending] = useActionState(importTransactions, undefined);

  useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result, router]);

  return (
    <form action={action} className="space-y-2">
      <input
        type="file"
        name="file"
        accept=".csv,.xlsx"
        required
        className="block w-full cursor-pointer rounded-lg border bg-transparent text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
      />
      <Button type="submit" size="sm" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Importing…" : "Import CSV / Excel"}
      </Button>
      {result && <p className={cn("text-xs", result.ok ? "text-positive" : "text-negative")}>{result.message}</p>}
    </form>
  );
}
