import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { listMembers, memberSettings } from "@/lib/auth/member-store";
import { monthStart } from "@/lib/ai/ledger";
import { passRevenueSatang, passSettings } from "@/lib/members/pass-store";
import { Card, PageHead } from "../ui";
import { MembersAdmin } from "./MembersAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมาชิกทั่วไป | AdvisorTool" };

const WHO = "คนนอก UnitOS ที่สมัครเองด้วยบัญชี Google ใช้ Studio ได้เหมือนตัวแทนทั่วไป — ";
/** satang as a price reads: 9900 → "99", 14950 → "149.50" */
const price = (satang: number) => (satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2));

/**
 * People outside UnitOS who signed up with Google (owner, 2026-10-02): the switch, the list, and
 * suspension. With the pass on, each member's pass too, and days given by hand (owner, 2026-10-13).
 */
export default async function MembersPage() {
  await gatePage("/admin/members", "backoffice");
  const [settings, members, pass, revenue] = await Promise.all([
    memberSettings().catch((e) => {
      console.error("member settings unreadable:", e);
      return null;
    }),
    listMembers().catch((e) => {
      console.error("members unreadable:", e);
      return null;
    }),
    passSettings().catch((e) => {
      console.error("member pass settings unreadable:", e);
      return null;
    }),
    // the tile shows "—" rather than taking the page down with it
    passRevenueSatang(monthStart()).catch((e) => {
      console.error("member pass revenue unreadable:", e);
      return null;
    }),
  ]);
  const hint = pass?.enabled
    ? `${WHO}จ่ายค่าสมาชิก ฿${price(pass.satang)} ต่อ 30 วัน ได้ Studio ฟรี ${pass.rounds} รอบทุก 30 วัน`
    : `${WHO}รอบฟรี 10 รอบ แล้วเติมเงินในกระเป๋า`;
  return (
    <>
    <PageHead title="สมาชิกทั่วไป" hint="คนนอก UnitOS ที่สมัครเองด้วย Google · ตั้งราคาค่าสมาชิกที่หน้าราคาและโปรโมชัน" />
    <Card title="สมาชิก" hint={hint}>
      <MembersAdmin settings={settings} members={members} passOn={pass?.enabled === true}
                    revenueSatang={revenue} now={new Date().toISOString()} />
    </Card>
    </>
  );
}
