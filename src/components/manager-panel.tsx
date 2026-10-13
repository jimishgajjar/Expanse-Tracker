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
  defaultOpen,
  onOpenChange,
}: {
  trigger: ReactElement;
  title: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Sheet defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
      <SheetTrigger render={trigger} />
      <SheetContent className="manager-panel gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]">
        <SheetHeader className="shrink-0 gap-0 border-b border-border bg-card p-5 pr-16">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
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
        <div className="manager-panel-body min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain bg-background p-4 sm:p-5">
          {children}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
      className="group/create overflow-hidden rounded-xl border border-border bg-card"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
        <Plus className="size-4 shrink-0" aria-hidden />
        {title}
        <ChevronDown
          className="ml-auto size-4 shrink-0 transition-transform group-open/create:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border p-4 [&>form]:border-0 [&>form]:bg-transparent [&>form]:p-0">
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
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
