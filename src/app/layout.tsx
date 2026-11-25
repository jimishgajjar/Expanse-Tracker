import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PreviewFeatures } from "@/components/settings-provider";
import { householdFeaturesEnabled } from "@/lib/household-features";
import { merchantRulesEnabled } from "@/lib/merchant-rule-feature";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { DensityPreference } from "@/components/display-density";
import { Toaster } from "@/components/ui/sonner";

// IBM Plex Sans carries the interface: sturdy, engineered, with true tabular figures
// for every money column. Source Serif 4 is the "engraved" voice used only for page
// titles and headline balances, the way a passbook or banknote sets its numerals.
const plex = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], axes: ["wdth"] });
const serif = Source_Serif_4({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Track income, expenses, accounts and categories across personal and shared trackers.",
  applicationName: "Expense Tracker",
  appleWebApp: { capable: true, title: "Expense Tracker", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let content + safe-area insets extend under the notch / home indicator so
  // the app chrome can reach the screen edges like a native app.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${plex.variable} ${serif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <PreviewFeatures rules={merchantRulesEnabled()} comments={householdFeaturesEnabled()}>{children}</PreviewFeatures>
          <DensityPreference />
          <Toaster richColors position="top-center" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
