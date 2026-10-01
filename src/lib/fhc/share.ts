import { formatBaht } from "@/calc/money";
import { INSURER } from "@/lib/insurer";
import type { PlanResult } from "@/lib/plan/recommend";
import type { EventRow, FhcFigures, Level, Score } from "./health";
import type { FhcSummary } from "./summary";

/** The check as a LINE message: plain text, the same figures the page shows. */

const DOT: Record<Level, string> = { green: "🟢", yellow: "🟡", red: "🔴", none: "⚪" };
const baht = (n: number) => Math.round(n).toLocaleString("en-US");

export const DISCLAIMER =
  `ตัวเลขเป็นการประมาณเบื้องต้นจากข้อมูลที่กรอก ไม่ใช่ข้อเสนอขาย เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท · รับประกันโดย ${INSURER}`;

export function lineText({ figures, scores, events, plan, summary }: {
  figures: FhcFigures; scores: Score[]; events: EventRow[]; plan: PlanResult; summary?: FhcSummary | null;
}): string {
  const offers = plan.areas.filter((a) => a.offer && (a.status === "fits" || a.status === "reduced"));
  return [
    "📋 Financial Health Check",
    ...(summary ? ["", summary.start] : []),
    "",
    "━━ สุขภาพการเงิน ━━",
    ...scores.map((s) => `${DOT[s.level]} ${s.label}: ${s.shown}`),
    `• สินทรัพย์สุทธิ ${baht(figures.netWorth)} บาท · ค่าความสามารถในการทำงาน ${baht(figures.lifetimeIncome)} บาท`,
    "",
    "━━ 5 เหตุการณ์ควบคุมไม่ได้ ━━",
    ...events.map((e, i) => `${i + 1}. ${e.name}: ${e.lines.join(" / ")}`),
    "",
    `━━ แผนประกัน (เฉลี่ยเดือนละ ${formatBaht(Math.round(plan.usedAnnual / 12))} บาท) ━━`,
    ...(offers.length
      ? offers.map((a) => `• ${a.offer!.product} · ${a.offer!.firstYear ? "ปีแรก" : "ปีละ"} ${formatBaht(a.offer!.annual)} บาท`)
      : ["• ยังไม่มีแบบที่พอดีกับงบ"]),
    "",
    DISCLAIMER,
  ].join("\n");
}
