"use client";

import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function MoreActions({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted-foreground"
            aria-label={label}
          />
        }
      >
        <Ellipsis className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:gap-3 [&_[role=menuitem]]:px-3"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
