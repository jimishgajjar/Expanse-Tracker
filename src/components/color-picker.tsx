"use client";

import { Check } from "lucide-react";
import { COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
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
    </div>
  );
}
