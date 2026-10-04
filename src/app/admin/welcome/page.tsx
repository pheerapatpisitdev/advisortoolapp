import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { isExpatPage } from "@/lib/assistant/expat";
import { allWelcomes } from "@/lib/chat/page-welcome-store";
import { defaultWelcomeText } from "@/lib/assistant/page-welcome";
import { Card, Empty } from "../ui";
import { WelcomeEditor } from "./WelcomeEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ข้อความต้อนรับ | AdvisorTool" };

export default async function AdminWelcomePage() {
  await gatePage("/admin/welcome", "admin");
  const [pages, saved] = await Promise.all([
    pageConnections().then((all) => all.filter((p) => !isExpatPage(p.pageId))).catch((e) => {
      console.error("pages unreadable:", e);
      return null;
    }),
    allWelcomes().catch((e) => {
      console.error("page welcomes unreadable:", e);
      return null;
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-lg font-semibold">ข้อความต้อนรับ</h1>
      <p className="mb-5 text-sm text-[var(--bot-ink-mute)]">
        สิ่งที่บอทส่งให้ลูกค้าที่ทักเพจมาครั้งแรกโดยยังไม่บอกว่าสนใจอะไร บันทึกแล้วมีผลกับข้อความถัดไปทันที
        เพจ Expat ใช้บอทภาษาอังกฤษ จึงไม่อยู่ในหน้านี้
      </p>
      {!pages || !saved ? (
        <Card title="อ่านข้อมูลไม่สำเร็จ"><Empty>ลองรีเฟรชหน้านี้อีกครั้ง</Empty></Card>
      ) : !pages.length ? (
        <Card title="ยังไม่มีเพจ"><Empty>เชื่อมเพจที่หน้า Messenger ก่อน</Empty></Card>
      ) : (
        pages.map((p) => {
          const row = saved.get(p.pageId);
          return (
            <WelcomeEditor
              key={p.pageId}
              pageId={p.pageId}
              pageName={p.pageName}
              saved={row ?? null}
              initial={row ?? { mode: "menu", text: defaultWelcomeText("menu"), pictures: [] }}
            />
          );
        })
      )}
    </div>
  );
}
