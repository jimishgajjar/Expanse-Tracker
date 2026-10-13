"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Icon,
  ICON_NAMES,
  ICON_CATEGORY_GROUPS,
  ICON_SEARCH_TAGS,
} from "@/components/icon";
import { cn } from "@/lib/utils";

export function IconPicker({
  value,
  color = "#10b981",
  onChange,
}: {
  value: string;
  color?: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const filteredIcons = useMemo(() => {
    const q = query.trim().toLowerCase();
    const icons =
      selectedGroup === "all"
        ? ICON_NAMES
        : (ICON_CATEGORY_GROUPS.find((g) => g.id === selectedGroup)?.icons ??
          ICON_NAMES);

    if (!q) return icons;

    return icons.filter((name) => {
      if (name.toLowerCase().includes(q)) return true;
      const tags = ICON_SEARCH_TAGS[name] || [];
      return tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [query, selectedGroup]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Pick an icon"
            className="group flex h-11 shrink-0 items-center gap-2 rounded-xl border-border/80 bg-card px-2.5 shadow-2xs hover:border-brand/40 hover:bg-muted/30 transition-all active:scale-[0.98]"
          />
        }
      >
        <span
          className="grid size-7 place-items-center rounded-lg transition-transform group-hover:scale-105"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon name={value} size={16} />
        </span>
        <span className="hidden text-xs font-medium text-foreground sm:inline truncate max-w-24">
          {value}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground opacity-60 transition-transform group-aria-expanded:rotate-180" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(380px,calc(100vw-32px))] p-3 rounded-xl shadow-xl border border-border/80 bg-popover"
        align="start"
      >
        <div className="space-y-3">
          {/* Header Preview & Search */}
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl shadow-xs ring-1 ring-border"
              style={{ backgroundColor: `${color}18`, color }}
            >
              <Icon name={value} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground truncate">
                Selected: {value}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                240+ icons across 10 categories
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              aria-label="Search icons"
              className="h-8 pl-8 text-xs rounded-lg bg-muted/40 border-border/70 focus-visible:ring-brand/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedGroup("all")}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                selectedGroup === "all"
                  ? "bg-brand text-brand-foreground shadow-2xs font-semibold"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              All ({ICON_NAMES.length})
            </button>
            {ICON_CATEGORY_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroup(group.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selectedGroup === group.id
                    ? "bg-brand text-brand-foreground shadow-2xs font-semibold"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {group.name}
              </button>
            ))}
          </div>

          {/* Icon Grid */}
          <div className="h-56 overflow-y-auto pr-1">
            {filteredIcons.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No icons matched &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {filteredIcons.map((name) => {
                  const isSelected = name === value;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                      }}
                      className={cn(
                        "group relative grid aspect-square place-items-center rounded-xl p-1 transition-all",
                        isSelected
                          ? "bg-brand/15 text-brand ring-2 ring-brand shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95",
                      )}
                    >
                      <Icon
                        name={name}
                        size={17}
                        color={isSelected ? color : undefined}
                      />
                      {isSelected && (
                        <span className="absolute -top-0.5 -right-0.5 grid size-3 place-items-center rounded-full bg-brand text-white">
                          <Check className="size-2" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
