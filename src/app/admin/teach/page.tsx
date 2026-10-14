import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { isExpatPage } from "@/lib/assistant/expat";
import { allWelcomes } from "@/lib/chat/page-welcome-store";
import { defaultWelcomeText } from "@/lib/assistant/page-welcome";
import { Card, Empty, PageHead } from "../ui";
import { loadUnanswered } from "../crm/actions";
import { listContentWords, listLessons, listNotes } from "../knowledge/actions";
import { Lessons } from "../knowledge/Lessons";
import { Notes } from "../knowledge/Notes";
import { Words } from "../knowledge/Words";
import { WelcomeEditor } from "../welcome/WelcomeEditor";
import { TestChat } from "./TestChat";
import { TaughtList } from "./TaughtList";
import { TeachTabs } from "./TeachTabs";
import { TestsList } from "./TestsList";
import { Unanswered } from "./Unanswered";
import { listBotTests, listTaught } from "./actions";
import { IntroPictures } from "./IntroPictures";
import { listIntro } from "./intro-actions";

export const dynamic = "force-dynamic";
/**
 * a turn can reach a model, and a model is given up to a minute by the inbox too; สรุปแชทตอนนี้
 * (บทเรียนจากแชท) runs as this page's action, a model reading a day of chats, and wants five
 */
export const maxDuration = 300;
export const metadata: Metadata = { title: "สอนบอท | AdvisorTool" };

/**
 * สอนบอท (owner chose ข, 2026-10-15): what was three pages — ห้องสอนบอท (the test chat, taught
 * answers, tests, the pictures ahead of a quote), สอน AI (lessons from chats, notes, words) and
 * ข้อความต้อนรับ (each Page's greeting) — plus the questions the bot could not answer, which
 * were a tab of ลูกค้าจากแชท. It opens on the test chat (owner, 2026-10-15).
 */
export default async function TeachPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  await gatePage("/admin/teach", "backoffice");
  const [pages, taught, tests, intro, open, notes, words, lessons, welcomes, params] = await Promise.all([
    pageConnections().catch((e) => {
      console.error("pages unreadable:", e);
      return null;
    }),
    listTaught(),
    listBotTests(),
    listIntro(),
    loadUnanswered(),
    listNotes(),
    // a list that cannot be read takes its own tab's half down, never the test chat beside it
    listContentWords().catch((e) => {
      console.error("content words unreadable:", e);
      return null;
    }),
    listLessons(),
    allWelcomes().catch((e) => {
      console.error("page welcomes unreadable:", e);
      return null;
    }),
    searchParams,
  ]);
  // a question brought from the unanswered list opens the teaching panel with it
  const brought = typeof params.q === "string" ? params.q.slice(0, 200) : undefined;
  const first = brought ? "chat" : params.tab;
  const head = <PageHead title="สอนบอท" hint="ทดลองคุยกับบอทแบบลูกค้า แก้คำตอบ และตั้งสิ่งที่บอทส่งให้ลูกค้าที่ทักมาใหม่" />;

  if (!pages) return <>{head}<Card title="อ่านรายชื่อเพจไม่สำเร็จ"><Empty>ลองรีเฟรชหน้านี้อีกครั้ง</Empty></Card></>;
  if (!pages.length) return <>{head}<Card title="ยังไม่มีเพจ"><Empty>เชื่อมเพจที่หน้า เพจและช่องทาง ก่อน</Empty></Card></>;

  const choices = pages.map((p) => ({ id: p.pageId, name: p.pageName, expat: isExpatPage(p.pageId) }));
  // the Expat Pages answer in their own English bot and have no greeting here
  const greeted = pages.filter((p) => !isExpatPage(p.pageId));

  return (
    <>
      {head}
      {/* keyed on what was asked for, so สอนคำตอบ (a link to this same page) opens the chat with
          its question rather than leaving the tabs where they were */}
      <TeachTabs
        key={`${first ?? ""}|${brought ?? ""}`}
        first={first}
        tabs={[
          { key: "chat", label: "ทดลองแชท", content: <TestChat pages={choices} question={brought} /> },
          {
            key: "unanswered",
            label: open && open.total > 0 ? `บอทตอบไม่ได้ (${open.total})` : "บอทตอบไม่ได้",
            content: <Unanswered open={open} />,
          },
          { key: "lessons", label: "บทเรียนจากแชท", content: <Lessons review={lessons.review} initial={lessons.lessons} /> },
          {
            key: "taught",
            label: taught.ok ? `คำตอบที่สอนไว้ (${taught.rows.length})` : "คำตอบที่สอนไว้",
            content: taught.ok
              ? <TaughtList initial={taught.rows} pages={choices} />
              : <Card title="อ่านรายการไม่สำเร็จ"><Empty>{taught.error}</Empty></Card>,
          },
          {
            key: "notes",
            label: "โน้ตและคำ",
            content: (
              <>
                {/* keyed on the list, so a lesson taken with ใช้ shows up here without a reload */}
                <Notes key={notes.map((n) => n.id).join(",")} initial={notes} />
                {words ? <Words initial={words} /> : <Card title="อ่านรายการคำไม่สำเร็จ"><Empty>ลองรีเฟรชหน้านี้อีกครั้ง</Empty></Card>}
              </>
            ),
          },
          {
            key: "welcome",
            label: "ต้อนรับและรูป",
            content: (
              <>
                <p className="mb-3 text-sm text-[var(--bot-ink-mute)]">
                  สิ่งที่บอทส่งให้ลูกค้าที่ทักเพจมาครั้งแรกโดยยังไม่บอกว่าสนใจอะไร บันทึกแล้วมีผลกับข้อความถัดไปทันที
                  เพจ Expat ใช้บอทภาษาอังกฤษ จึงไม่อยู่ในส่วนนี้
                </p>
                {!welcomes ? (
                  <Card title="อ่านข้อความต้อนรับไม่สำเร็จ"><Empty>ลองรีเฟรชหน้านี้อีกครั้ง</Empty></Card>
                ) : (
                  greeted.map((p) => {
                    const row = welcomes.get(p.pageId);
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
                {intro.ok
                  ? <IntroPictures rows={intro.rows} builtIn={intro.builtIn} pages={choices} />
                  : <Card title="อ่านรูปไม่สำเร็จ"><Empty>{intro.error}</Empty></Card>}
              </>
            ),
          },
          {
            key: "tests",
            label: tests.ok ? `ชุดเทส (${tests.tests.length})` : "ชุดเทส",
            content: tests.ok
              ? <TestsList initial={tests.tests} pages={choices} />
              : <Card title="อ่านชุดเทสไม่สำเร็จ"><Empty>{tests.error}</Empty></Card>,
          },
        ]}
      />
    </>
  );
}
