import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { Card } from "../ui";
import { listStaff } from "./actions";
import { Team } from "./Team";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ทีมงาน | advisortool" };

/** The owner's assistants: who may post to the Page, connect it, or open the back office. */
export default async function TeamPage() {
  await gatePage("/admin/team", "owner");
  const [rows, connected] = await Promise.all([listStaff(), pageConnections().catch(() => [])]);
  const pages = connected.map((p) => ({ pageId: p.pageId, pageName: p.pageName }));
  return (
    <Card
      title="ทีมงาน"
      hint="ตัวแทนใน UnitOS ที่ช่วยดูแลเพจ — เพิ่มด้วยรหัสตัวแทน 6 หลัก คนที่เพิ่มใหม่ลงโพสต์และตั้งเวลาได้ แต่ยังไม่เห็นเพจไหนจนกว่าจะติ๊กเพจที่ดูแล ส่วนเชื่อมเพจและหลังบ้านให้ติ๊กเพิ่มเป็นรายคน"
    >
      <Team rows={rows} pages={pages} />
    </Card>
  );
}
