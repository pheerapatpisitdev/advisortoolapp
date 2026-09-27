import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { Card } from "../ui";
import { listStaff } from "./actions";
import { Team } from "./Team";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ทีมงาน | advisortool" };

/** The owner's assistants: who may post to the Page, connect it, or open the back office. */
export default async function TeamPage() {
  await gatePage("/admin/team", "owner");
  const rows = await listStaff();
  return (
    <Card
      title="ทีมงาน"
      hint="ตัวแทนใน UnitOS ที่ช่วยดูแลเพจ — เพิ่มด้วยรหัสตัวแทน 6 หลัก คนที่เพิ่มใหม่ลงโพสต์และตั้งเวลาได้ ส่วนเชื่อมเพจและหลังบ้านให้ติ๊กเพิ่มเป็นรายคน"
    >
      <Team rows={rows} />
    </Card>
  );
}
