"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspace } from "@/lib/actions";
import type { WorkspaceSummary } from "@/lib/workspace";

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  currentUserId,
}: {
  workspaces: WorkspaceSummary[];
  activeId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = workspaces.find((w) => w.id === activeId);

  function select(id: string) {
    if (id === activeId) return;
    start(async () => {
      const res = await switchWorkspace(id);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} className="max-w-[11rem]" />}>
        <span className="truncate">{active?.name ?? "Account"}</span>
        <ChevronsUpDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch tracker</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => select(w.id)}>
              <span className="flex-1 truncate">{w.name}</span>
              {w.ownerId !== currentUserId && <span className="text-xs text-muted-foreground">shared</span>}
              {w.id === activeId && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
