import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and auto-linked by Next — makes the app
// installable (add-to-home-screen), which is also what unlocks Web Push on iOS.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Tracker",
    short_name: "Expenses",
    description: "Track income, expenses, accounts, subscriptions and bills — personal and shared.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1116",
    theme_color: "#047857",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
