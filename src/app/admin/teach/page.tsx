import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { isExpatPage } from "@/lib/assistant/expat";
import { Card, Empty } from "../ui";
import { TestChat } from "./TestChat";
import { TaughtList } from "./TaughtList";
import { TeachTabs } from "./TeachTabs";
import { TestsList } from "./TestsList";
import { listBotTests, listTaught } from "./actions";
import { IntroPictures } from "./IntroPictures";
import { listIntro } from "./intro-actions";

export const dynamic = "force-dynamic";
/** a turn can reach a model, and a model is given up to a minute by the inbox too */
export const maxDuration = 120;
export const metadata: Metadata = { title: "ห้องสอนบอท | AdvisorTool" };

/**
 * ห้องสอนบอท (owner, 2026-10-11): the owner talks to the bot as a customer of one Page, sees
 * where each answer came from, and teaches an answer word for word where the bot's was wrong.
 */
export default async function TeachPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  await gatePage("/admin/teach", "admin");
  const [pages, taught, tests, intro, params] = await Promise.all([
    pageConnections().catch((e) => {
      console.error("pages unreadable:", e);
      return null;
    }),
    listTaught(),
    listBotTests(),
    listIntro(),
    searchParams,
  ]);
  // a question brought from /admin/crm's unanswered list opens the teaching panel with it
  const brought = typeof params.q === "string" ? params.q.slice(0, 200) : undefined;

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
        (() => {
          const choices = pages.map((p) => ({ id: p.pageId, name: p.pageName, expat: isExpatPage(p.pageId) }));
          return (
            <TeachTabs
              first={params.tab}
              tabs={[
                { key: "chat", label: "แชททดลอง", content: <TestChat pages={choices} question={brought} /> },
                {
                  key: "taught",
                  label: taught.ok ? `คำตอบที่สอนไว้ (${taught.rows.length})` : "คำตอบที่สอนไว้",
                  content: taught.ok
                    ? <TaughtList initial={taught.rows} pages={choices} />
                    : <Card title="อ่านรายการไม่สำเร็จ"><Empty>{taught.error}</Empty></Card>,
                },
                {
                  key: "tests",
                  label: tests.ok ? `ชุดเทส (${tests.tests.length})` : "ชุดเทส",
                  content: tests.ok
                    ? <TestsList initial={tests.tests} pages={choices} />
                    : <Card title="อ่านชุดเทสไม่สำเร็จ"><Empty>{tests.error}</Empty></Card>,
                },
                {
                  key: "pictures",
                  label: "รูปที่บอทส่ง",
                  content: intro.ok
                    ? <IntroPictures rows={intro.rows} builtIn={intro.builtIn} pages={choices} />
                    : <Card title="อ่านรูปไม่สำเร็จ"><Empty>{intro.error}</Empty></Card>,
                },
              ]}
            />
          );
        })()
      )}
    </div>
  );
}
