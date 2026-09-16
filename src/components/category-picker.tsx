"use client";

import { useState } from "react";
import { Check, ChevronDown, Search, Tags } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { Input } from "./ui/input";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import type { CategoryDTO } from "@/lib/queries";

export function CategoryPicker({
  id,
  categories,
  kind,
  value,
  onChange,
}: {
  id: string;
  categories: CategoryDTO[];
  kind: "income" | "expense";
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categories.find((category) => category.id === value);
  const matches = categories.filter((category) =>
    category.name
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  function choose(id: string | null) {
    onChange(id);
    setOpen(false);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSearch("");
      }}
    >
      <PopoverTrigger
        render={<button type="button" id={id} />}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-input px-3 py-2 text-left text-sm hover:bg-muted/40"
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-md"
          style={
            selected
              ? {
                  backgroundColor: `${selected.color}18`,
                  color: selected.color,
                }
              : undefined
          }
        >
          {selected ? (
            <Icon name={selected.icon} size={16} />
          ) : (
            <Tags className="size-4 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1 break-words">
          {selected?.name ?? "No category"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-32px))] gap-3 p-3"
      >
        <PopoverTitle className="text-sm">
          {kind === "income" ? "Income categories" : "Expense categories"}
        </PopoverTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search categories"
            placeholder="Search categories…"
            className="min-h-11 pl-9"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
        <div
          className="max-h-[min(280px,40dvh)] overflow-y-auto overscroll-contain p-1"
          role="group"
          aria-label={`${kind} categories`}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {matches.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={value === category.id}
                onClick={() => choose(category.id)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                  value === category.id
                    ? "border-brand bg-brand/5"
                    : "border-transparent",
                )}
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-md"
                  style={{
                    backgroundColor: `${category.color}18`,
                    color: category.color,
                  }}
                >
                  <Icon name={category.icon} size={16} />
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {category.name}
                </span>
                {value === category.id && (
                  <Check className="size-3.5 shrink-0 text-brand" aria-hidden />
                )}
              </button>
            ))}
          </div>
          {matches.length === 0 && (
            <p className="py-5 text-center text-xs text-muted-foreground">
              {categories.length
                ? "No matching categories. Try another name."
                : `No ${kind} categories yet. You can add one from Categories.`}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => choose(null)}
          className="flex min-h-11 items-center gap-2 border-t pt-2 text-left text-sm text-muted-foreground hover:text-foreground"
        >
          <Tags className="size-4" /> No category
          {value === null && (
            <Check className="ml-auto size-4 text-brand" aria-hidden />
          )}
        </button>
      </PopoverContent>
    </Popover>
  );
}
