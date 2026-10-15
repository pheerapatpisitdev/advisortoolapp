import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { passSettings } from "@/lib/members/pass-store";
import { referralReport, referralSettings } from "@/lib/referrals/store";
import { monthlyBudget, nextFirst, readFreeCap } from "@/lib/wallet/free-cap";
import { walletPrices } from "@/lib/wallet/store";
import { PageHead } from "../ui";
import { PricesAdmin } from "./PricesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ราคาและโปรโมชัน | AdvisorTool" };

/**
 * ราคาและโปรโมชัน (owner chose ข, 2026-10-15): three cards that were on กระเป๋าเงินตัวแทน, and
 * เพดานงบใช้ฟรีต่อเดือน since the same day (option ก, in place of งบสร้างคอนเทนต์ on /admin/ai).
 */
export default async function PricesPage() {
  await gatePage("/admin/prices", "backoffice");
  const now = new Date();
  const [prices, pass, referral, report, free, monthly] = await Promise.all([
    // never throws: the defaults when the column is not there yet
    walletPrices(),
    // the outside members' 30-day pass (owner, 2026-10-13); null before 20261027_member_pass
    passSettings().catch((e) => {
      console.error("member pass settings unreadable:", e);
      return null;
    }),
    // เพื่อนชวนเพื่อน (owner, 2026-10-14); null before 20261103_referrals
    referralSettings().catch((e) => {
      console.error("referral settings unreadable:", e);
      return null;
    }),
    referralReport().catch((e) => {
      console.error("referral report unreadable:", e);
      return null;
    }),
    // null before 20261111_free_budget, or when the month cannot be read
    readFreeCap(now).catch((e) => {
      console.error("free cap unreadable:", e);
      return null;
    }),
    monthlyBudget().catch(() => null),
  ]);
  return (
    <>
      <PageHead title="ราคาและโปรโมชัน" hint="สิ่งที่ตัวแทนและสมาชิกจ่าย ตั้งที่นี่ที่เดียว" />
      <PricesAdmin prices={prices} pass={pass} referral={referral} report={report} free={free && { ...free, monthly, until: nextFirst(now) }} />
    </>
  );
}
