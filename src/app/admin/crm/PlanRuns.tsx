import { formatBaht } from "@/calc/money";
import type { PlanInput } from "@/lib/plan/needs";
import type { PlanResult } from "@/lib/plan/recommend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 24 * 60 * 60 * 1000;
const AREA: Record<string, string> = { life: "ชีวิต", health: "สุขภาพ", ci: "โรคร้าย", retire: "บำนาญ" };

/** Plans customers built on /fhc (and on /plan, until 2026-10-01) in the last thirty days: how many, and the latest twenty. */
export async function PlanRuns() {
  const { data, error } = await supabaseAdmin()
    .from("ins_plan_runs")
    .select("created_at,input,result")
    .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return <p className="text-sm text-[var(--bot-ink-mute)]">อ่านข้อมูลการวางแผนไม่ได้: {error.message}</p>;
  const rows = (data ?? []) as { created_at: string; input: PlanInput; result: PlanResult }[];
  const week = rows.filter((r) => Date.parse(r.created_at) > Date.now() - 7 * DAY).length;
  return (
    <section className="space-y-3 rounded-lg border border-[var(--bot-line)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--bot-ink)]">ลูกค้าวางแผนเอง (/fhc)</h2>
        <p className="text-sm text-[var(--bot-ink-mute)]">7 วัน {week} ครั้ง · 30 วัน {rows.length} ครั้ง</p>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--bot-ink-mute)]">
              <tr><th className="py-1.5 pr-3">เวลา</th><th className="pr-3">ที่มา</th><th className="pr-3">อายุ</th><th className="pr-3">เงินเดือน</th><th className="pr-3">ที่เสนอ</th><th className="pr-3">ลำดับ</th><th>เบี้ยรวม/ปี</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.created_at} className="border-t border-[var(--bot-line)] text-[var(--bot-ink)]">
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {new Date(r.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="pr-3">{(r.input as { from?: string }).from === "fhc" ? "FHC" : "plan"}</td>
                  <td className="pr-3 tabular-nums">{r.input.age}</td>
                  <td className="pr-3 tabular-nums">{r.input.income.toLocaleString("en-US")}</td>
                  <td className="pr-3">
                    {r.result.areas.filter((a) => a.status === "fits" || a.status === "reduced").map((a) => AREA[a.key]).join(" · ") || "—"}
                  </td>
                  <td className="whitespace-nowrap pr-3">
                    {r.result.order
                      ? `${r.result.order.map((k) => AREA[k]).join("→")}${r.result.orderedBy === "ai" ? " (AI)" : ""}`
                      : "—"}
                  </td>
                  <td className="tabular-nums">{formatBaht(r.result.usedAnnual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
