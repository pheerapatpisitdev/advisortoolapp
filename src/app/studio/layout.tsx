import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { PassReminder, reminderOf } from "@/components/shell/PassReminder";
import { can } from "@/lib/auth/access";
import { gatePage, whoOf } from "@/lib/auth/viewer";
import { memberAccess } from "@/lib/members/access";
import { studioMenu } from "@/lib/shell/menu";
import { walletPrices, walletSettings } from "@/lib/wallet/store";
import { ThemeSwitch } from "./ThemeSwitch";
import { PricesProvider } from "./ui/prices";

/**
 * Every page of Studio in one frame: Studio's own menu in place of the application's, and the
 * content palette. Pressing Studio in the main menu lands somewhere of its own (owner,
 * 2026-09-27) — its pages down the side, "กลับระบบหลัก" the one way out. The pages under it
 * draw only their own content, so the menu stays put while the next page loads (loading.tsx).
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  // for UnitOS agents only since 2026-09-27; the pages under it that are staff's ask again
  const viewer = await gatePage("/studio");
  // the wallet is in the menu only while the owner has it on, and never for the owner, who writes
  // without one (owner, 2026-09-30; assistants got theirs 2026-10-02); a settings read that fails
  // hides it rather than the page
  // and a member's last three days, as a bar over every Studio page (owner, 2026-10-13)
  const [settings, prices, reminder] = await Promise.all([walletSettings().catch(() => null), walletPrices(), reminderOf(viewer, memberAccess)]);
  const wallet = can(viewer, "owner") ? false : settings?.enabled === true;
  // the price list in the menu while the wallet is on, for the owner too, who sees what agents pay (owner, 2026-10-12)
  const who = { ...whoOf(viewer)!, wallet, prices: settings?.enabled === true };
  return (
    <div className="content-page">
      <AppShell menu={studioMenu(who)} brand={{ href: who?.admin || who?.publish ? "/studio" : "/studio/write", label: "Studio" }} footer={<ThemeSwitch />} who={who}>
        {/* pt-16 below lg: the phone's menu button is fixed at the top left */}
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-6">
          {reminder && <div className="mb-4"><PassReminder {...reminder} /></div>}
          <PricesProvider prices={prices}>{children}</PricesProvider>
        </div>
      </AppShell>
    </div>
  );
}
