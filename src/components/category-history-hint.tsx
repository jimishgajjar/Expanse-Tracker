"use client";

import { useState } from "react";
import { lookupCategoryHistory } from "@/lib/actions";
import type { CategoryDTO } from "@/lib/queries";

export function CategoryHistoryHint({note, type, accountId, categories, onChoose}: {
  note: string; type: "expense" | "income"; accountId: string;
  categories: CategoryDTO[]; onChoose: (id:string) => void;
}) {
  const [status,setStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [matches,setMatches] = useState<{categoryId:string; count:number}[]>([]);
  async function lookup() {
    setStatus("loading");
    try {
      const result = await lookupCategoryHistory({note,type,accountId});
      if (!result.ok) { setStatus("error"); return; }
      setMatches(result.rows.filter(row=>categories.some(c=>c.id===row.categoryId)));
      setStatus("done");
    } catch { setStatus("error"); }
  }
  return <div className="space-y-1 text-xs">
    {status!=="done"&&<button type="button" disabled={status==="loading"} onClick={lookup}
      className="min-h-8 font-medium text-brand underline-offset-4 hover:underline">
      {status==="loading"?"Checking history…":"Suggest category from history"}
    </button>}
    <p role="status" className="text-muted-foreground">{status==="error"?"Couldn’t check past entries. Try again.":status==="done"?
      matches.length?"Categories previously used for this note and account. Select one to apply it.":"No categorized entries with this note on this account yet.":""}</p>
    {matches.length>0&&<div className="flex flex-wrap gap-1.5">{matches.map(row=>
      <button type="button" key={row.categoryId} onClick={()=>onChoose(row.categoryId)}
        className="min-h-8 rounded-lg border bg-background px-2.5 font-medium hover:bg-muted">
        {categories.find(c=>c.id===row.categoryId)?.name} · {row.count} {row.count===1?"entry":"entries"}
      </button>)}</div>}
  </div>;
}
