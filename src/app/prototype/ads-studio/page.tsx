import { Suspense } from "react";
import { notFound } from "next/navigation";
import "../../studio/theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { studioMenu } from "@/lib/shell/menu";
import { AdsStudioPrototype } from "./AdsStudioPrototype";

/**
 * PROTOTYPE — throwaway (2026-10-04). Ads Studio as one page in Organic Studio's three columns,
 * with sample data and no database. Not shipped: gone in a production build.
 * Question: does one page (tools · ads · sent) feel like Organic Studio?
 */
export const metadata = { title: "PROTOTYPE · Ads Studio" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const who = { name: "Owner", room: "LuckyPlanner", publish: true, connect: true, admin: true, owner: true, member: false };
  return (
    <div className="content-page">
      <AppShell menu={studioMenu(who)} brand={{ href: "/studio", label: "Studio" }} who={who}>
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-6">
          <Suspense><AdsStudioPrototype /></Suspense>
        </div>
      </AppShell>
    </div>
  );
}
