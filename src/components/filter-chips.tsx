"use client";
import { X } from "lucide-react";
import { Button } from "./ui/button";

export type FilterChip = { key: string; label: string; onRemove: () => void };
export function FilterChips({
  chips,
  onClear,
}: {
  chips: FilterChip[];
  onClear: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          aria-label={`Remove filter: ${chip.label}`}
          className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 text-sm text-brand transition-colors hover:bg-brand/10"
        >
          <span className="truncate">{chip.label}</span>
          <X className="size-3.5 shrink-0" />
        </button>
      ))}
      <Button
        variant="ghost"
        className="min-h-11 text-muted-foreground"
        onClick={onClear}
      >
        Clear all
      </Button>
    </div>
  );
}
