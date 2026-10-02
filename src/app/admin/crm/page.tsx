import type { Metadata } from "next";
import Link from "next/link";
import { loadCrm } from "./actions";
import { share } from "@/lib/crm/summary";
import type { Range } from "@/lib/crm/types";
import { Kpis } from "./Kpis";
import { Funnel } from "./Funnel";
import { Charts } from "./Charts";
import { Leads } from "./Leads";
import { PlanRuns } from "./PlanRuns";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ลูกค้า | AdvisorTool" };

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
];

const TABS = [
  { key: "recent", label: "ลูกค้าล่าสุด" },
  { key: "follow", label: "ต้องตามต่อ" },
  { key: "unanswered", label: "คำถามที่ตอบไม่ได้" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function isRange(v: string | undefined): v is Range {
  return v === "today" || v === "7d" || v === "30d";
}

function isTab(v: string | undefined): v is Tab {
  return v === "recent" || v === "follow" || v === "unanswered";
}

/**
 * Said where a figure should be when the figure could not be read.
 *
 * In the place of the zeros that used to stand there: a failed read and a quiet week drew the
 * same, and the owner reading "0 คนทักเข้ามา" had no way to tell which one had happened.
 */
function ReadFailed({ parts }: { parts: string[] }) {
  return (
    <p className="rounded-xl border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-4 py-3 text-sm text-[var(--bot-sand-ink)]">
      อ่านข้อมูลไม่สำเร็จ: {parts.join(" · ")} — ส่วนนี้ยังไม่แสดงตัวเลข ลองเปิดหน้านี้ใหม่อีกครั้ง
    </p>
  );
}

export default async function CrmPage(
  { searchParams }: { searchParams: Promise<{ range?: string; tab?: string }> },
) {
  await gatePage("/admin/crm", "admin");
  const params = await searchParams;
  const range = isRange(params.range) ? params.range : "7d";
  const tab = isTab(params.tab) ? params.tab : "recent";
  const { summary, leads, following, unanswered, aiCost, failed } = await loadCrm(range, tab);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  /** The list under the tab, and the length of the whole of it. */
  const counts = {
    recent: leads?.total,
    follow: following?.total,
    unanswered: unanswered?.total,
  } satisfies Record<Tab, number | undefined>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/crm?range=${r.key}&tab=${tab}`}
            className={`rounded-lg border px-3.5 py-1.5 text-sm ${
              r.key === range
                ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
                : "border-[var(--bot-line)] bg-white text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)]"
            }`}
          >
            {r.label}
          </Link>
        ))}
        {summary && summary.counts.arrived === 0 && (
          <p className="ml-auto text-xs text-[var(--bot-ink-mute)]">
            ยังไม่มีข้อมูลในช่วงนี้ — ระบบเริ่มบันทึกตั้งแต่วันที่อัปเดตบอท
          </p>
        )}
      </div>

      {failed.length > 0 && <ReadFailed parts={failed} />}

      {summary && (
        <>
          <Kpis counts={summary.counts} aiCost={aiCost} rangeLabel={rangeLabel} />
          <Funnel counts={summary.counts} byProduct={summary.byProduct} />
          <Charts byDay={summary.byDay} byHour={summary.byHour} byAd={summary.byAd} />
        </>
      )}

      <PlanRuns />

      <div>
        {/* its own scroller: three Thai labels with their counts are wider than a phone, and a
            row that wraps under itself loses the underline that says which tab is open */}
        <nav className="flex gap-0.5 overflow-x-auto border-b border-[var(--bot-line)]">
          {TABS.map((t) => {
            const n = counts[t.key];
            return (
              <Link
                key={t.key}
                href={`/admin/crm?range=${range}&tab=${t.key}`}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${
                  t.key === tab
                    ? "border-[var(--bot-navy)] font-semibold text-[var(--bot-ink)]"
                    : "border-transparent text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink-foot)]"
                }`}
              >
                {t.label} · {n === undefined ? "?" : n.toLocaleString("en-US")}
              </Link>
            );
          })}
        </nav>
        <Leads
          tab={tab}
          leads={tab === "follow" ? following : leads}
          unanswered={unanswered}
        />
      </div>

      <p className="rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-navy-soft)] px-3.5 py-3 text-xs leading-relaxed text-[var(--bot-navy)]">
        ชื่อกับรูปดึงสดจาก Facebook ตอนเปิดหน้านี้ ไม่ได้เก็บลงฐานข้อมูล ·
        ตัวเลขสถิติเก็บตลอด แต่รายละเอียดเหตุการณ์ถูกลบเมื่อเก่ากว่า 13 เดือน ·
        วันและเวลาทั้งหมดเป็นเวลาไทย
        {summary && <> · อัตราที่คิดได้ {share(summary.counts.priced, summary.counts.arrived)}% ของคนที่ทักเข้ามา</>}
      </p>
    </div>
  );
}
