import { IBM_Plex_Sans_Thai, Trirong } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { PrintUnfold } from "@/components/sales/PrintUnfold";

/**
 * Trirong is a Thai serif: it has the weight of something printed and kept, which is what a
 * page about what you leave behind should sound like. Kanit and Prompt are what every Thai
 * landing page reaches for, and they would make this one look like every other one.
 */
const display = Trirong({
  subsets: ["thai", "latin"],
  weight: ["500", "600"],
  variable: "--lg-font-display",
  display: "swap",
});

/** The reading face: a Thai grotesque with open counters, legible small on a phone. */
const body = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--lg-font-body",
  display: "swap",
});

/**
 * The skin every customer-facing sales page wears (styles in globals.css under
 * `.theme-legacy`). Wrapping each sales route rather than the app leaves the agent's
 * calculator and the back office in the plain light theme they are worked in all day.
 */
export function SalesTheme({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} theme-legacy min-h-screen`}>
      {/* The menu replaces the single "way home" button that used to sit here, and inherits
          its one hard-won rule: `.theme-legacy > *` in globals.css sets z-index 1 on every
          direct child and ties a Tailwind z utility on specificity, so what puts the menu
          above the page is being written after it. AppShell keeps that order. */}
      <AppShell>{children}</AppShell>
      {/* on paper every fold prints in full, so they open for the dialog */}
      <PrintUnfold />
    </div>
  );
}
