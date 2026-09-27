import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { studioMenu } from "@/lib/shell/menu";
import { ThemeSwitch } from "./ThemeSwitch";

/**
 * Every page of Studio in one frame: Studio's own menu in place of the application's, and the
 * content palette. Pressing Studio in the main menu lands somewhere of its own (owner,
 * 2026-09-27) — its pages down the side, "กลับระบบหลัก" the one way out. The pages under it
 * draw only their own content, so the menu stays put while the next page loads (loading.tsx).
 *
 * /maryjane draws the workbench without any of this — the owner asked for a page with nothing
 * else on it — so it imports StudioPage directly, keeps the old tab row (SubNav), and never
 * passes through here.
 */
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="content-page">
      <AppShell menu={studioMenu()} brand={{ href: "/studio", label: "Studio" }} footer={<ThemeSwitch />}>
        {/* pt-16 below lg: the phone's menu button is fixed at the top left */}
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-6">{children}</div>
      </AppShell>
    </div>
  );
}
