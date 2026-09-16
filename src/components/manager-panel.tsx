"use client";

import type { ReactElement, ReactNode } from "react";
import { ChevronDown, Plus, type LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Button } from "./ui/button";

/** Shared presentation only; each tool retains its existing actions and state. */
export function ManagerPanel({
  trigger,
  title,
  description,
  icon: Icon,
  children,
  open,
  onOpenChange,
}: {
  trigger: ReactElement;
  title: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger render={trigger} />
      <SheetContent className="manager-panel gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]">
        <SheetHeader className="shrink-0 gap-0 border-b bg-card p-4 pr-14">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <SheetTitle className="break-words text-base font-semibold leading-tight">
                {title}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs leading-relaxed">
                {description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="manager-panel-body min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-muted/15 p-4">
          {children}
        </div>
        <div className="flex shrink-0 justify-end border-t bg-card px-4 py-2">
          <SheetClose
            render={
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-9 min-w-20"
              />
            }
          >
            Done
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PanelCreate({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className="group/create rounded-xl border bg-card"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <Plus className="size-4 shrink-0" aria-hidden />
        {title}
        <ChevronDown
          className="ml-auto size-4 shrink-0 transition-transform group-open/create:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t p-3 [&>form]:border-0 [&>form]:bg-transparent [&>form]:p-0">
        {children}
      </div>
    </details>
  );
}

export function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
