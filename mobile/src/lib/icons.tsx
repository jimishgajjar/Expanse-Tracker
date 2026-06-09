import * as React from "react";
import * as Lucide from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { colors } from "./theme";

function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
}

const set = Lucide as unknown as Record<string, React.ComponentType<LucideProps>>;

/** Render a lucide icon by the name stored on accounts/categories — handles
    "wallet", "piggy-bank", or "Wallet". Same icon set as the web; falls back to
    a circle. (TODO: curate to the picker's ~180 icons to shrink the bundle.) */
export function LucideIcon({
  name,
  size = 18,
  color = colors.ink,
  strokeWidth = 2,
}: {
  name?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = (name && (set[name] ?? set[toPascal(name)])) || set.Circle;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
