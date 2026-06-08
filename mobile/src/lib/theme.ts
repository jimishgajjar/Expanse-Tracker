// Notion-style design tokens — warm near-black ink on white paper, soft gray
// hairlines, small radii, restrained green/red. Mirrors the web app.
export const colors = {
  bg: "#ffffff",
  card: "#ffffff",
  cardAlt: "#f7f6f3",
  ink: "#37352f",
  inkSoft: "#787774",
  inkFaint: "#9b9a97",
  border: "rgba(55,53,47,0.10)",
  borderStrong: "rgba(55,53,47,0.16)",
  hover: "#f1f1ef",
  green: "#0f7b6c",
  greenSoft: "#ddeae6",
  red: "#e03e3e",
  redSoft: "#fbe4e4",
  blue: "#0b6e99",
  yellow: "#cb912f",
  purple: "#6940a5",
  white: "#ffffff",
  overlay: "rgba(15,15,15,0.45)",
};

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };
export const space = (n: number) => n * 4;

export const chartColors = ["#0f7b6c", "#0b6e99", "#cb912f", "#e03e3e", "#6940a5", "#dd6b20", "#9b59b6"];
