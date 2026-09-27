import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { gatePage, whoOf } from "@/lib/auth/viewer";
import { studioMenu } from "@/lib/shell/menu";
import { ThemeSwitch } from "./ThemeSwitch";

/**
 * Every page of Studio in one frame: Studio's own menu in place of the application's, and the
 * content palette. Pressing Studio in the main menu lands somewhere of its own (owner,
 * 2026-09-27) — its pages down the side, "กลับระบบหลัก" the one way out. The pages under it
 * draw only their own content, so the menu stays put while the next page loads (loading.tsx).
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  // for UnitOS agents only since 2026-09-27; the pages under it that are staff's ask again
  const who = whoOf(await gatePage("/studio"));
  return (
    <div className="content-page">
      <AppShell menu={studioMenu(who)} brand={{ href: "/studio", label: "Studio" }} footer={<ThemeSwitch />} who={who}>
        {/* pt-16 below lg: the phone's menu button is fixed at the top left */}
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-6">{children}</div>
      </AppShell>
    </div>
  );
}
