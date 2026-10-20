import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { Card, PageHead } from "../ui";
import { listStaff } from "./actions";
import { listSpecial } from "./special-actions";
import { SpecialAccess } from "./SpecialAccess";
import { Team } from "./Team";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ทีมงาน | AdvisorTool" };

/** The owner's assistants: who may post to the Page, connect it, or open the back office. */
export default async function TeamPage() {
  await gatePage("/admin/team", "backoffice");
  const [rows, connected, special] = await Promise.all([listStaff(), pageConnections().catch(() => []), listSpecial()]);
  const pages = connected.map((p) => ({ pageId: p.pageId, pageName: p.pageName }));
  return (
    <>
    <PageHead title="ทีมงานและสิทธิ์" hint="ผู้ช่วยที่ดูแลเพจใน Studio และสิทธิ์ของแต่ละคน" />
    <Card
      title="ผู้ช่วย"
      hint="ตัวแทนใน UnitOS ที่ช่วยดูแลเพจ — เพิ่มด้วยรหัสตัวแทน 6 หลัก คนที่เพิ่มใหม่ลงโพสต์และตั้งเวลาได้ แต่ยังไม่เห็นเพจไหนจนกว่าจะติ๊กเพจที่ดูแล ส่วนเห็นทุกเพจให้ติ๊กเพิ่มเป็นรายคน หลังบ้านเป็นของ Super Admin เท่านั้น"
    >
      <Team rows={rows} pages={pages} />
    </Card>
    <Card
      title="สิทธิ์เข้าพิเศษ"
      hint="ตัวแทนที่ให้เข้า advisortool ได้แม้ Premium ใน UnitClub หมดหรือเป็น basic (ห้องต้องยังเปิดอยู่ใน UnitOS) พร้อมงบใช้ AI พิเศษต่อเดือน เริ่มใหม่ทุกวันที่ 1 ใช้งบนี้ก่อนเงินที่เติมเอง ที่เหลือไม่ยกไปเดือนหน้า"
    >
      <SpecialAccess rows={special} />
    </Card>
    </>
  );
}
