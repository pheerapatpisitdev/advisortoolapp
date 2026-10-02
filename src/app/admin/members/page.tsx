import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { listMembers, memberSettings } from "@/lib/auth/member-store";
import { FREE_ROUNDS } from "@/lib/auth/quota";
import { Card } from "../ui";
import { MembersAdmin } from "./MembersAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมาชิกทั่วไป | AdvisorTool" };

/** People outside UnitOS who signed up with Google (owner, 2026-10-02): the switch, the list, and suspension. */
export default async function MembersPage() {
  await gatePage("/admin/members", "admin");
  const [settings, members] = await Promise.all([
    memberSettings().catch((e) => {
      console.error("member settings unreadable:", e);
      return null;
    }),
    listMembers().catch((e) => {
      console.error("members unreadable:", e);
      return null;
    }),
  ]);
  return (
    <Card title="สมาชิกทั่วไป" hint="คนนอก UnitOS ที่สมัครเองด้วยบัญชี Google ใช้ Studio ได้เหมือนตัวแทนทั่วไป — รอบฟรี 10 รอบ แล้วเติมเงินในกระเป๋า">
      <MembersAdmin settings={settings} members={members} freeRounds={FREE_ROUNDS} />
    </Card>
  );
}
