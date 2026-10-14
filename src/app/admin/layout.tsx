import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { gatePage } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";
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
 * The back office, for the owner and the assistants the owner names (2026-09-27); for the Super
 * Admin alone since 2026-10-15, who signs in with the Google button on the front page.
 *
 * It was open at its address from 2026-09-22, by the owner's choice at the time; now that
 * advisortool shares UnitOS's database, the door is UnitOS's: an agent signs in with their own
 * code, and only staff (src/lib/auth/access.ts) get past this layout. Each page asks again for
 * its own permission, and every action behind it asks for itself — a layout does not guard an
 * action.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // the Super Admin's alone since 2026-10-15 (owner): agents, the owner's own account included,
  // are sent back to /home
  const viewer = await gatePage("/admin", "backoffice");
  const who = await shellWho(viewer);
  if (!who) redirect("/?next=%2Fadmin");
  return (
    // named for where it is, as Studio's menu is (owner chose ข, 2026-10-14); no way out to the
    // front of the app: the Super Admin has none (2026-10-15)
    <AppShell signedIn who={who} brand={{ href: "/admin", label: "หลังบ้าน" }}>
      <div className="mx-auto max-w-5xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">{children}</div>
    </AppShell>
  );
}
