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
      <SheetContent className="manager-panel gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="shrink-0 gap-0 border-b bg-card p-5 pr-16 sm:p-6 sm:pr-16">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <SheetTitle className="break-words text-xl font-semibold leading-tight">
                {title}
              </SheetTitle>
              <SheetDescription className="mt-2 text-xs leading-relaxed">
                {description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="manager-panel-body min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-muted/15 p-5 sm:p-6">
          {children}
        </div>
        <div className="flex shrink-0 justify-end border-t bg-card px-5 py-3 sm:px-6">
          <SheetClose
            render={
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-24"
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
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <Plus className="size-4 shrink-0" aria-hidden />
        {title}
        <ChevronDown
          className="ml-auto size-4 shrink-0 transition-transform group-open/create:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t p-4 [&>form]:border-0 [&>form]:bg-transparent [&>form]:p-0">
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
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
