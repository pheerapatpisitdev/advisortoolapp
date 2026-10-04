import type { Metadata } from "next";
import { studioThemeScript } from "@/lib/content/studio-theme";
import { RAIL_KEY } from "@/lib/shell/menu";
import { siteOrigin } from "@/lib/site-url";
import { MetaPixel } from "@/components/meta/Pixel";
import "./globals.css";

/**
 * What this app is called, and what it looks like when it leaves the browser.
 *
 * The icons beside this file are picked up by name — `icon.png` for the tab, `apple-icon.png`
 * for a phone's home screen, `opengraph-image.png` for a link pasted into LINE or Messenger —
 * so none of them is listed here. What has to be here is `metadataBase`: without it Next
 * writes the share image as a relative path, and LINE fetches images from its own servers,
 * where a relative path resolves to nothing. It reads the same setting the cards read rather
 * than a second copy that could drift from it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "คำนวณเบี้ยประกัน",
  description: "โปรแกรมคำนวณเบี้ยประกันสำหรับตัวแทน",
  /**
   * No title or description here on purpose.
   *
   * Setting them at the root sets them for every page, and the sales pages have titles
   * written to be shared — "Protection Life — ทุนหลักล้านด้วยเบี้ยที่จ่ายไหว" is a headline,
   * and replacing it with the site's name on the one surface a customer sees before
   * clicking throws away the better sentence. Left out, each page's own title and
   * description carry into the share card; what belongs to the whole site stays here.
   */
  openGraph: {
    siteName: "advisortool.app",
    locale: "th_TH",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the script sets data-shell before the first paint, which React did not render: hence the hush
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* the folded menu, remembered, applied before paint so the page does not jump sideways */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("${RAIL_KEY}")==="1")document.documentElement.dataset.shell="rail"}catch(e){}` }} />
        {/* Studio's light or dark, likewise before paint — read only by Studio's pages (studio-theme.ts) */}
        <script dangerouslySetInnerHTML={{ __html: studioThemeScript }} />
      </head>
      {/* The ground under everything, including the back office, which paints no ground of
          its own. Written as the palette rather than as a Tailwind grey so that there is one
          place a colour is decided and this is not a second one. */}
      <body className="min-h-screen bg-[var(--bot-band)] text-[var(--bot-ink)] antialiased">{children}<MetaPixel /></body>
    </html>
  );
}
