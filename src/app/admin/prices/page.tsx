import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { passSettings } from "@/lib/members/pass-store";
import { referralReport, referralSettings } from "@/lib/referrals/store";
import { agentStarterCredit, walletPrices } from "@/lib/wallet/store";
import { PageHead } from "../ui";
import { PricesAdmin } from "./PricesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ราคาและโปรโมชัน | AdvisorTool" };

/** ราคาและโปรโมชัน (owner chose ข, 2026-10-15): three cards that were on กระเป๋าเงินตัวแทน. */
export default async function PricesPage() {
  await gatePage("/admin/prices", "backoffice");
  const [prices, pass, referral, report, agentCredit] = await Promise.all([
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
    // a UnitClub agent's starter credit (owner, 2026-10-18); null before 20261121_agent_starter_credit
    agentStarterCredit(),
  ]);
  return (
    <>
      <PageHead title="ราคาและโปรโมชัน" hint="สิ่งที่ตัวแทนและสมาชิกจ่าย ตั้งที่นี่ที่เดียว" />
      <PricesAdmin prices={prices} pass={pass} referral={referral} report={report} agentCredit={agentCredit} />
    </>
  );
}
