import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { gatePage, whoOf } from "@/lib/auth/viewer";
import type { Metadata } from "next";

/**
 * The tab's name for every back-office page that does not name itself.
 *
 * Without it the tab said "คำนวณเบี้ยประกัน" — the calculator's title, inherited from the root —
 * on every screen here, so six open tabs looked like six copies of the calculator. Each page
 * that has a name of its own sets it; this is what the rest fall back to.
 */
export const metadata: Metadata = { title: "หลังบ้าน | AdvisorTool" };

/**
 * The back office, for the owner and the assistants the owner names (2026-09-27).
 *
 * It was open at its address from 2026-09-22, by the owner's choice at the time; now that
 * advisortool shares UnitOS's database, the door is UnitOS's: an agent signs in with their own
 * code, and only staff (src/lib/auth/access.ts) get past this layout. Each page asks again for
 * its own permission, and every action behind it asks for itself — a layout does not guard an
 * action.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await gatePage("/admin");
  const who = whoOf(viewer);
  if (!who || !(who.admin || who.connect || who.publish)) redirect("/studio");
  return (
    <AppShell signedIn who={who}>
      <div className="mx-auto max-w-5xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">{children}</div>
    </AppShell>
  );
}
