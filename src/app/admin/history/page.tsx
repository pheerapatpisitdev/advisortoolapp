import type { Metadata } from "next";
import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { readFeed, readPeople } from "@/lib/admin/people-history-read";
import { groupDays } from "@/lib/admin/people-history";
import { Empty, PageHead } from "../ui";
import { Lines } from "./Lines";
import { PeopleTable } from "./PeopleTable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ประวัติผู้ใช้ | AdvisorTool" };

/**
 * ประวัติผู้ใช้ (owner, 2026-10-15; mockup https://claude.ai/artifact/2uzD38rmUBZ223o6SPG3M1):
 * everybody who uses the system — agents in their units and สมาชิกทั่วไป — and, a click on a
 * name away, their whole history (./[id]). The other tab is everybody's newest lines in one
 * stream. The Super Admin's alone, like every page here.
 */
const TABS = [
  { key: "people", label: "รายชื่อทุกคน" },
  { key: "feed", label: "ฟีดทุกคน" },
] as const;

const FEED_DAYS = 7;
const FEED_LINES = 200;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/history", "backoffice");
  const view = (await searchParams).view === "feed" ? "feed" : "people";
  const now = new Date();

  let body: React.ReactNode;
  if (view === "feed") {
    const feed = await readFeed(FEED_DAYS, FEED_LINES).catch((e) => {
      console.error("people history feed not read:", e);
      return null;
    });
    body = !feed ? (
      <p className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2.5 text-sm text-[var(--bot-red-ink)]">อ่านฟีดไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
    ) : feed.items.length ? (
      <div className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
        <Lines days={groupDays(feed.items, now)} names={feed.names} />
        <p className="mt-3 text-xs text-[var(--bot-ink-mute)]">{FEED_LINES} รายการล่าสุดใน {FEED_DAYS} วัน · กดชื่อเพื่อดูประวัติทั้งหมดของคนนั้น</p>
      </div>
    ) : (
      <Empty>ยังไม่มีใครทำอะไรใน {FEED_DAYS} วันที่ผ่านมา</Empty>
    );
  } else {
    const people = await readPeople(now).catch((e) => {
      console.error("people list not read:", e);
      return null;
    });
    body = people ? <PeopleTable people={people} nowIso={now.toISOString()} /> : (
      <p className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2.5 text-sm text-[var(--bot-red-ink)]">อ่านรายชื่อไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="ประวัติผู้ใช้" hint="ทุกคนที่ใช้ระบบ ทั้งตัวแทนและสมาชิกทั่วไป กดชื่อเพื่อดูประวัติทุกรายการ" />
      <nav className="flex gap-0.5 overflow-x-auto border-b border-[var(--bot-line)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "people" ? "/admin/history" : "/admin/history?view=feed"}
            aria-current={t.key === view ? "page" : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm no-underline ${t.key === view
              ? "border-[var(--bot-navy)] font-semibold text-[var(--bot-ink)]"
              : "border-transparent text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink-foot)]"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {body}
    </div>
  );
}
