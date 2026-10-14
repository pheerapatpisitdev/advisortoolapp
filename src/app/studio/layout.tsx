import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { PassReminder, reminderOf } from "@/components/shell/PassReminder";
import { gatePage } from "@/lib/auth/viewer";
import { memberAccess } from "@/lib/members/access";
import { studioMenu } from "@/lib/shell/menu";
import { shellWho } from "@/lib/shell/who";
import { walletPrices } from "@/lib/wallet/store";
import { ThemeSwitch } from "./ThemeSwitch";
import { PricesProvider } from "./ui/prices";

/**
 * Every page of Studio in one frame: Studio's own menu in place of the application's, and the
 * content palette. Pressing Studio in the main menu lands somewhere of its own (owner,
 * 2026-09-27) — its pages down the side, "ระบบหลัก" the way out. The pages under it
 * draw only their own content, so the menu stays put while the next page loads (loading.tsx).
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  // for UnitOS agents only since 2026-09-27; the pages under it that are staff's ask again
  const viewer = await gatePage("/studio");
  // the wallet and the price list for the account box (src/lib/shell/who.ts), and a member's
  // last three days, as a bar over every Studio page (owner, 2026-10-13)
  const [who, prices, reminder] = await Promise.all([shellWho(viewer).then((w) => w!), walletPrices(), reminderOf(viewer, memberAccess)]);
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
