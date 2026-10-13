"use client";

import { useState } from "react";
import { Check, Shuffle } from "lucide-react";
import { COLORS, COLOR_HARMONIES, getColorCombo } from "@/lib/colors";
import { cn } from "@/lib/utils";

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 65 + Math.floor(Math.random() * 25);
  const l = 42 + Math.floor(Math.random() * 12);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Wheel sampled from the preset palette itself
const WHEEL = [...COLORS.filter((_, i) => i % 4 === 0), COLORS[0]].join(", ");

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const isCustom = !COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
  const combo = getColorCombo(value);

  const displayedColors =
    !expanded
      ? [...new Set([...COLORS.slice(0, 10), value])]
      : activeTab === "all"
      ? COLORS
      : (COLOR_HARMONIES.find((h) => h.id === activeTab)?.colors ?? COLORS);

  return (
    <div className="color-picker min-w-0 space-y-3">
      {/* Harmony filter pills */}
      {expanded && <div className="flex flex-wrap items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          aria-pressed={activeTab === "all"}
          className={cn(
            "min-h-8 rounded-md px-2 py-1 font-medium transition-colors whitespace-nowrap",
            activeTab === "all"
              ? "bg-foreground/10 text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {COLOR_HARMONIES.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setActiveTab(h.id)}
            aria-pressed={activeTab === h.id}
            className={cn(
              "min-h-8 rounded-md px-2 py-1 font-medium transition-colors whitespace-nowrap",
              activeTab === h.id
                ? "bg-foreground/10 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {h.name}
          </button>
        ))}
      </div>}

      {/* Swatches Grid */}
      <div className="flex flex-wrap items-center gap-1.5">
        {displayedColors.map((c) => {
          const isSelected = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Color ${c}`}
              aria-pressed={isSelected}
              className={cn(
                "group relative grid size-8 place-items-center rounded-lg ring-offset-2 ring-offset-background transition-all hover:scale-110 active:scale-95 shadow-2xs",
                isSelected && "ring-2 ring-foreground/40 scale-105",
              )}
              style={{ backgroundColor: c }}
            >
              {isSelected && <Check className="size-3.5 text-white drop-shadow-xs" />}
            </button>
          );
        })}

        {/* Custom Color Input */}
        <label
          title="Custom HEX Color"
          className={cn(
            "relative grid size-8 cursor-pointer place-items-center rounded-lg ring-offset-2 ring-offset-background transition-all hover:scale-110 focus-within:ring-2 focus-within:ring-foreground/40 shadow-2xs",
            isCustom && "ring-2 ring-foreground/40 scale-105",
          )}
          style={{
            background: isCustom ? value : `conic-gradient(from 0deg, ${WHEEL})`,
          }}
        >
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#10b981"}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Pick custom color"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {isCustom && <Check className="size-3.5 text-white drop-shadow-xs" />}
        </label>

        {/* Random / Shuffle Color */}
        <button
          type="button"
          onClick={() => onChange(randomColor())}
          aria-label="Random harmonious color"
          title="Random color"
          className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 shadow-2xs"
        >
          <Shuffle className="size-3" />
        </button>
      </div>

      {/* Live Badge Preview */}
      <div className="flex items-center gap-2 pt-1 text-xs">
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="mr-auto min-h-8 text-xs font-medium text-brand hover:underline">
          {expanded ? "Fewer colours" : "More colours"}
        </button>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border"
          style={{
            backgroundColor: combo.background,
            borderColor: combo.border,
            color: combo.text,
          }}
        >
          <span
            className="size-2 rounded-lg"
            style={{ backgroundColor: combo.text }}
          />
          <span>{value}</span>
        </span>
      </div>
    </div>
  );
}
