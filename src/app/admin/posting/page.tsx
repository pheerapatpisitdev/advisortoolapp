import type { Metadata } from "next";
import Link from "next/link";
import { Card, Empty } from "../ui";
import { pageConnections } from "@/lib/facebook/connection";
import { activityByPage, checkPosting, POST_SCOPE, type PageActivity, type PostingCheck } from "@/lib/content/posting-health";
import { thaiWhen } from "@/lib/content/publish-label";
import { listPublishRows } from "@/lib/content/store";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ออโต้โพสต์ | advisortool" };

/**
 * The Facebook connection as the content workbench sees it: which Pages it can post to right
 * now, and what it has put on each so far. The owner asked for it on 2026-09-25, the day a
 * newly connected Page showed on the calendar while Facebook refused it everything.
 *
 * The connection itself is the Messenger one — one login, one token per Page, for the bot and
 * for posting alike — so connecting and reconnecting stay on that screen and this one sends
 * the owner there rather than keeping a second login that could revoke the first.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-[var(--bot-line)] py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 text-[var(--bot-ink-mute)]">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

const OK = "text-[var(--bot-ok)]";
const BAD = "text-[var(--bot-red-ink)]";
const WARN = "text-[var(--bot-sand-ink)]";

const when = (iso: string) => thaiWhen(new Date(iso));

function Live({ check }: { check: PostingCheck }) {
  if (check.status === "ok") return <span className={OK}>✓ Facebook ยอมให้ระบบจัดการโพสต์ของเพจนี้</span>;
  if (check.status === "unknown") return <span className={WARN}>ตรวจไม่ได้ชั่วคราว</span>;
  return <span className={BAD}>✗ โพสต์และตั้งเวลาโพสต์ลงเพจนี้ไม่ได้</span>;
}

function Activity({ a }: { a: PageActivity }) {
  return (
    <>
      <Row label="ตั้งเวลาไว้">
        {a.scheduled > 0 ? <>{a.scheduled} โพสต์ · โพสต์ถัดไป {when(a.nextAt!)}</> : "ไม่มี"}
      </Row>
      <Row label="โพสต์ขึ้นแล้ว">
        {a.published > 0 ? <>{a.published} โพสต์ · ล่าสุด {when(a.lastPublishedAt!)}</> : "ยังไม่มี"}
      </Row>
      {a.failed > 0 && (
        <Row label="ค้างไม่สำเร็จ">
          <span className={BAD}>{a.failed} ชิ้น</span>
          <span className="text-[var(--bot-ink-mute)]"> · ล่าสุด: {a.lastError}</span>
        </Row>
      )}
    </>
  );
}

export default async function PostingAdminPage() {
  await gatePage("/admin/posting", "admin");
  const [connections, rows] = await Promise.all([
    pageConnections(),
    /** null when the table could not be read — then the counts are left off, not shown as zero */
    listPublishRows().catch((e) => {
      console.error("posting counts failed:", e);
      return null;
    }),
  ]);
  // asked per Page, as the Messenger screen does: one Page refusing says nothing of the others
  const checks = await Promise.all(connections.map((c) => checkPosting(c.pageId)));
  const activity = rows ? activityByPage(rows) : null;

  const pages = connections.map((c, i) => ({ c, check: checks[i], granted: c.scopes.includes(POST_SCOPE) }));
  const blocked = pages.filter((p) => p.check.status === "bad" || !p.granted);

  return (
    <>
      {pages.length > 0 && (
        /* said once at the top, because the red is further down on a phone and the Page that
           cannot post is the one the calendar will keep failing on */
        <p
          className={`mb-4 rounded-md px-3 py-2 text-sm ${blocked.length
            ? "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"
            : "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]"}`}
        >
          {blocked.length
            ? <>โพสต์ได้ {pages.length - blocked.length} จาก {pages.length} เพจ — เพจ {blocked.map((p) => p.c.pageName).join(", ")} โพสต์ไม่ได้ ดูวิธีแก้ในกล่องของเพจนั้น</>
            : <>โพสต์ได้ทุกเพจ ({pages.length} เพจ)</>}
        </p>
      )}

      <Card title="เพจที่ระบบคอนเทนต์โพสต์ให้" hint="สถานะอ่านสดจาก Meta ทุกครั้งที่เปิดหน้านี้ ตรวจโดยไม่โพสต์อะไรลงเพจ">
        {pages.length === 0 ? (
          <Empty>
            ยังไม่มีเพจที่เชื่อมไว้ — เชื่อมเพจที่หน้า <Link href="/admin/messenger">Messenger</Link> แล้วกลับมาดูที่นี่
          </Empty>
        ) : (
          <div className="space-y-5">
            {pages.map(({ c, check, granted }) => {
              const bad = check.status === "bad" || !granted;
              return (
                <div
                  key={c.pageId}
                  className={`rounded-lg border p-3 ${bad ? "border-[var(--bot-red)] bg-[var(--bot-red-soft)]" : "border-[var(--bot-line)]"}`}
                >
                  <Row label="ชื่อเพจ"><span className="font-medium">{c.pageName}</span></Row>
                  <Row label="โพสต์ได้ตอนนี้"><Live check={check} /></Row>
                  <Row label="สิทธิ์โพสต์">
                    {granted
                      ? <span className={OK}>✓ อนุญาตให้จัดการโพสต์แล้วตอนเชื่อมต่อ</span>
                      : <span className={BAD}>✗ ตอนเชื่อมต่อไม่ได้อนุญาตให้จัดการโพสต์</span>}
                  </Row>
                  {activity && <Activity a={activity.get(c.pageId) ?? { scheduled: 0, nextAt: null, published: 0, lastPublishedAt: null, failed: 0, lastError: null }} />}
                  <Row label="เชื่อมต่อเมื่อ">{when(c.connectedAt)}</Row>

                  {check.status === "bad" && (
                    <div className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">
                      <p>{check.advice}</p>
                      {/* Meta's own words, under a Thai line that says what they are */}
                      <p className="mt-1 text-xs">ข้อความจาก Facebook (ส่งให้คนดูแลระบบได้เลย): <span className="break-all">{check.detail}</span></p>
                    </div>
                  )}
                  {check.status !== "bad" && !granted && (
                    <p className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">
                      เชื่อมเพจใหม่ที่หน้า Messenger แล้วกดอนุญาตให้จัดการโพสต์ของเพจ
                    </p>
                  )}
                  {check.status === "unknown" && (
                    <p className="mt-2 rounded-md bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]">{check.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--bot-line)] pt-4">
          <Link
            href="/admin/messenger"
            className="inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0653cc]"
          >
            เชื่อมเพจใหม่ / เพิ่มเพจ
          </Link>
          <Link
            href="/studio/calendar"
            className="inline-block rounded-md border border-[var(--bot-line)] px-4 py-2 text-sm font-medium no-underline"
          >
            เปิดปฏิทินโพสต์
          </Link>
        </div>
        <p className="mt-3 text-xs text-[var(--bot-ink-mute)]">
          ระบบคอนเทนต์ใช้การเชื่อมเพจเดียวกับบอท Messenger การเชื่อมใหม่จึงทำที่หน้า Messenger —
          ตอนเลือกเพจใน Facebook ให้ติ๊กทุกเพจพร้อมกัน เพจที่ไม่ได้ติ๊กจะถูกถอนสิทธิ์ทั้งบอทและการโพสต์
        </p>
      </Card>
    </>
  );
}
