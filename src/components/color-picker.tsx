"use client";

import { Check, Shuffle } from "lucide-react";
import { COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

function randomColor() {
  // A random but usable tint: full hue range, saturation/lightness kept in the
  // band where white icon glyphs stay readable on the 13%-alpha tiles.
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 20);
  const l = 42 + Math.floor(Math.random() * 14);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// The custom swatch's colour wheel, sampled from the preset palette itself
// (every 3rd hue, wrapped) so the affordance stays in the app's own colours.
const WHEEL = [...COLORS.filter((_, i) => i % 3 === 0), COLORS[0]].join(", ");

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const isCustom = !COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
          className={cn(
            "grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-background transition",
            value === c && "ring-2 ring-ring",
          )}
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}

      {/* Any colour at all: the native colour picker behind a wheel swatch.
          When the current value isn't a preset, this swatch owns the selection. */}
      <label
        title="Custom colour"
        className={cn(
          "relative grid size-6 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-background transition focus-within:ring-2 focus-within:ring-ring",
          isCustom && "ring-2 ring-ring",
        )}
        // One property for both states — React doesn't support switching between
        // the background shorthand and backgroundColor longhand across renders.
        style={{ background: isCustom ? value : `conic-gradient(from 0deg, ${WHEEL})` }}
      >
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#0f7b6c"}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a custom colour"
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        {isCustom && <Check className="size-3.5 text-white" />}
      </label>

      <button
        type="button"
        onClick={() => onChange(randomColor())}
        aria-label="Random colour"
        title="Random colour"
        className="grid size-6 place-items-center rounded-full border text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Shuffle className="size-3.5" />
      </button>
    </div>
  );
}
