import "../../home-theme.css";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { can } from "@/lib/auth/access";
import { gatePage, whoOf } from "@/lib/auth/viewer";
import {
  byDay, isHistKind, KIND_FILTERS, matches, monthLabel, monthOptions, monthRange, parseMonth, shiftMonth, summarize,
  FIRST_MONTH, type Month,
} from "@/lib/home/history";
import { readHistory } from "@/lib/home/history-read";
import { HistoryList } from "../HistoryList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ประวัติการทำงาน | AdvisorTool",
  description: "ทุกงานที่ทำในระบบ ย้อนหลังทีละเดือน",
};

/** a month holds far fewer than this per table; the cap only keeps a runaway read bounded */
const PER_TABLE = 1000;
const Q_MAX = 60;

const card = "rounded-xl border border-[var(--hm-hair)] bg-[var(--hm-panel)]";

/**
 * ประวัติการทำงาน, the whole of it (owner chose option ก, 2026-10-14): one month at a time,
 * newest first under each day, filtered by kind and by a search. Plain links and a GET form,
 * so the address holds the view and the back button returns to it.
 */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await gatePage("/home/history");
  const params = await searchParams;
  const now = new Date();
  const month = parseMonth(params.m, now);
  const kind = isHistKind(params.k) ? params.k : "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, Q_MAX) : "";

  const [from, to] = monthRange(month);
  let all: Awaited<ReturnType<typeof readHistory>> | null = null;
  try {
    all = await readHistory(viewer, from, to, PER_TABLE);
  } catch (e) {
    console.error("history page: not read:", e);
  }
  const sum = all && summarize(all);
  const shown = (all ?? []).filter((h) => (kind === "all" || h.kind === kind) && (!q || matches(h, q)));
  const days = byDay(shown, now);
  // the owner pays for nothing and has no wallet (2026-10-02): no money figure for them
  const wallet = !can(viewer, "owner");
  const older: Month | null = month > FIRST_MONTH ? shiftMonth(month, -1) : null;

  const href = (over: { m?: string; k?: string }) => {
    const p = new URLSearchParams();
    const m = over.m ?? month;
    const k = over.k ?? kind;
    if (m !== parseMonth(undefined, now)) p.set("m", m);
    if (k !== "all") p.set("k", k);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/home/history?${s}` : "/home/history";
  };

  return (
    <div className="home-chat">
      <AppShell who={whoOf(viewer)}>
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-10 pt-3 lg:pt-6">
          <header className="max-lg:ml-12">
            <Link href="/home" className="text-sm text-[var(--hm-accent)]">← หน้าหลัก</Link>
            <h1 className="text-2xl font-semibold text-balance">ประวัติการทำงาน</h1>
            <p className="text-sm text-[var(--hm-mute)]">ทุกงานที่ทำในระบบ ย้อนหลังได้ทั้งหมด</p>
          </header>

          <form action="/home/history" method="get" className="flex flex-wrap items-center gap-2">
            <label htmlFor="hist-month" className="sr-only">เดือน</label>
            <select id="hist-month" name="m" defaultValue={month} className="min-h-10 rounded-lg border border-[var(--hm-hair)] bg-[var(--hm-panel)] px-2.5 text-sm text-[var(--hm-ink)]">
              {monthOptions(now).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <label htmlFor="hist-q" className="sr-only">ค้นหา</label>
            <input
              id="hist-q" name="q" defaultValue={q} maxLength={Q_MAX} placeholder="ค้นชื่อลูกค้า หรือคำในโพสต์"
              className="min-h-10 min-w-0 flex-1 basis-40 rounded-lg border border-[var(--hm-hair)] bg-[var(--hm-panel)] px-2.5 text-sm text-[var(--hm-ink)]"
            />
            {kind !== "all" && <input type="hidden" name="k" value={kind} />}
            <button type="submit" className="min-h-10 rounded-lg bg-[var(--hm-solid)] px-4 text-sm font-semibold text-[var(--hm-solid-ink)]">ดู</button>
          </form>

          <nav aria-label="หมวด" className="flex flex-wrap gap-1.5">
            {KIND_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ k: f.key })}
                aria-current={kind === f.key ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-[13px] no-underline ${kind === f.key
                  ? "border-[var(--hm-solid)] bg-[var(--hm-solid)] text-[var(--hm-solid-ink)]"
                  : "border-[var(--hm-hair)] bg-[var(--hm-panel)] text-[var(--hm-ink)]"}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {sum && (
            <div className={`grid gap-2 text-center ${wallet ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
              {[
                { v: String(sum.studio), l: "ชิ้นงาน Studio" },
                { v: String(sum.clips), l: "คลิปเสร็จ" },
                { v: String(sum.customers), l: "ลูกค้า FHC" },
                ...(wallet ? [{ v: `฿${(sum.spentSatang / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, l: "ใช้ไปเดือนนี้" }] : []),
              ].map((t) => (
                <div key={t.l} className={`${card} px-2 py-2`}>
                  <strong className="block text-xl tabular-nums">{t.v}</strong>
                  <span className="text-xs text-[var(--hm-mute)]">{t.l}</span>
                </div>
              ))}
            </div>
          )}

          <section className={`${card} min-w-0 px-4 py-3.5`}>
            <h2 className="sr-only">{monthLabel(month)}</h2>
            {!all ? (
              <p className="py-2 text-sm text-[var(--hm-alert)]">อ่านประวัติไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
            ) : days.length === 0 ? (
              <p className="py-2 text-sm text-[var(--hm-mute)]">
                {q || kind !== "all" ? "ไม่พบงานที่ตรงกับที่เลือกในเดือนนี้" : `ยังไม่มีงานใน${monthLabel(month)}`}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {days.map((d, n) => (
                  <div key={d.day} className="flex flex-col">
                    <h3 className={`${n ? "mt-3" : ""} mb-1 text-[13px] font-semibold text-[var(--hm-mute)]`}>{d.label}</h3>
                    <HistoryList items={d.items.map((h) => ({ ...h, when: h.time }))} />
                  </div>
                ))}
              </div>
            )}
            {older && (
              <Link
                href={href({ m: older })}
                className="mt-3 block rounded-lg border border-dashed border-[var(--hm-hair)] py-2 text-center text-sm font-semibold text-[var(--hm-accent)] no-underline"
              >
                ดูย้อนหลังเพิ่ม · {monthLabel(older)}
              </Link>
            )}
          </section>
        </div>
      </AppShell>
    </div>
  );
}
