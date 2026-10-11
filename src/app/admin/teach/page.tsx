import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { isExpatPage } from "@/lib/assistant/expat";
import { Card, Empty } from "../ui";
import { TestChat } from "./TestChat";

export const dynamic = "force-dynamic";
/** a turn can reach a model, and a model is given up to a minute by the inbox too */
export const maxDuration = 120;
export const metadata: Metadata = { title: "ห้องสอนบอท | AdvisorTool" };

/**
 * ห้องสอนบอท (owner, 2026-10-11): the owner talks to the bot as a customer of one Page, sees
 * where each answer came from, and teaches an answer word for word where the bot's was wrong.
 */
export default async function TeachPage() {
  await gatePage("/admin/teach", "admin");
  const pages = await pageConnections().catch((e) => {
    console.error("pages unreadable:", e);
    return null;
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-lg font-semibold">ห้องสอนบอท</h1>
      <p className="mb-5 text-sm text-[var(--bot-ink-mute)]">
        คุยกับบอทแบบลูกค้าในเพจ ใช้สมองบอทตัวเดียวกับ Messenger แต่ไม่ส่งถึงลูกค้าและไม่บันทึกเป็นแชทลูกค้า
        ถ้าคำตอบไหนไม่ถูกใจ กด ✎ สอน แล้วบอทจะตอบตามที่สอนทุกคำ
      </p>
      {!pages ? (
        <Card title="อ่านรายชื่อเพจไม่สำเร็จ"><Empty>ลองรีเฟรชหน้านี้อีกครั้ง</Empty></Card>
      ) : !pages.length ? (
        <Card title="ยังไม่มีเพจ"><Empty>เชื่อมเพจที่หน้า Messenger ก่อน</Empty></Card>
      ) : (
        <TestChat pages={pages.map((p) => ({ id: p.pageId, name: p.pageName, expat: isExpatPage(p.pageId) }))} />
      )}
    </div>
  );
}
