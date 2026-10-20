import type { IndexWeek } from "@/lib/index-levels/parse";
import { REPORT_PAGE } from "@/lib/index-levels/parse";
import { INDEX_NAME } from "@/calc/global-saving/factsheet";

/**
 * The index's newest Monday under the calculator, read each morning from Krungthai-AXA's weekly
 * report (owner chose ก, 2026-10-20; mockup https://claude.ai/artifact/7Y9hw3W7n372ejfzjcqFQh):
 * the level and its move from the week before, the baht rate, a line of every week kept, and the
 * figures themselves folded away until opened (ก).
 */

const day = (iso: string, year = false) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("th-TH", {
  timeZone: "UTC", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}),
});
/** "5 ต.ค. 69" for the table */
const dayShortYear = (iso: string) => `${day(iso)} ${String(new Date(`${iso}T00:00:00Z`).getUTCFullYear() + 543).slice(2)}`;
const signed = (n: number, digits = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;

export function LiveIndex({ weeks }: { weeks: IndexWeek[] }) {
  if (!weeks.length) return null;
  const last = weeks[weeks.length - 1];
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const move = prev ? last.level - prev.level : null;
  const hi = weeks.reduce((a, w) => (w.level > a.level ? w : a));
  const lo = weeks.reduce((a, w) => (w.level < a.level ? w : a));
  const n = weeks.length;

  return (
    <section className="mt-10 space-y-4 border-t border-[var(--lg-hair)] pt-8" aria-labelledby="gs-live">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-[var(--lg-mute)]">ราคาดัชนีล่าสุด · อัปเดตอัตโนมัติทุกสัปดาห์</p>
          <h2 id="gs-live" className="text-xl font-semibold">{INDEX_NAME}</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 text-xs text-[var(--bot-ok)]">
          <i className="h-1.5 w-1.5 rounded-full bg-current" />ข้อมูลล่าสุดที่บริษัทประกาศ
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[4fr_8fr]">
        <div className="min-w-0 rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
          <p className="text-4xl font-bold tabular-nums leading-tight text-[var(--lg-gold)]">
            {last.level.toFixed(2)}<span className="ml-1 text-base font-medium text-[var(--lg-mute)]">จุด</span>
          </p>
          <p className="text-sm text-[var(--lg-mute)]">ณ วันจันทร์ที่ {day(last.date, true)}</p>
          {prev && move !== null && (
            <p className="mt-2.5 text-sm tabular-nums">
              จากสัปดาห์ก่อน ({day(prev.date)} {prev.level.toFixed(2)}){" "}
              <b className={move >= 0 ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}>
                {move >= 0 ? "▲" : "▼"} {signed(move)} จุด ({signed(move / prev.level * 100)}%)
              </b>
            </p>
          )}
          <dl className="mt-3.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-[var(--lg-hair)] pt-3 text-sm tabular-nums">
            <dt className="text-[var(--lg-mute)]">อัตราแลกเปลี่ยน</dt><dd className="text-right">{last.fx.toFixed(4)} บาท/ดอลลาร์</dd>
            <dt className="text-[var(--lg-mute)]">สูงสุด {n} สัปดาห์</dt><dd className="text-right">{hi.level.toFixed(2)} <span className="text-xs text-[var(--lg-mute)]">({day(hi.date)})</span></dd>
            <dt className="text-[var(--lg-mute)]">ต่ำสุด {n} สัปดาห์</dt><dd className="text-right">{lo.level.toFixed(2)} <span className="text-xs text-[var(--lg-mute)]">({day(lo.date)})</span></dd>
          </dl>
        </div>

        <div className="min-w-0 rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
          <h3 className="text-base font-semibold">
            ราคาดัชนีรายสัปดาห์ <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">ทุกวันจันทร์ · {day(weeks[0].date)} – {day(last.date, true)}</span>
          </h3>
          <WeekChart weeks={weeks} />
          <details className="mt-2.5 border-t border-[var(--lg-hair)] pt-2.5">
            <summary className="cursor-pointer text-sm font-medium text-[var(--lg-gold)]">ดูตัวเลขทุกสัปดาห์ ({n} สัปดาห์)</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="bg-[var(--bot-navy)] text-white print:[print-color-adjust:exact]">
                    <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium">วันที่</th>
                    <th className="whitespace-nowrap px-2.5 py-1.5 text-right font-medium">ราคาดัชนี</th>
                    <th className="whitespace-nowrap px-2.5 py-1.5 text-right font-medium">เปลี่ยน</th>
                    <th className="whitespace-nowrap px-2.5 py-1.5 text-right font-medium">บาท/ดอลลาร์</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w, i) => ({ w, c: i ? w.level - weeks[i - 1].level : null })).reverse().map(({ w, c }) => (
                    <tr key={w.date} className={`border-b border-[var(--lg-hair)] ${w === last ? "bg-[var(--bot-navy-soft)] font-semibold" : ""}`}>
                      <td className="whitespace-nowrap px-2.5 py-1">{dayShortYear(w.date)}</td>
                      <td className="px-2.5 py-1 text-right">{w.level.toFixed(2)}</td>
                      <td className={`px-2.5 py-1 text-right ${c === null ? "" : c >= 0 ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>{c === null ? "–" : signed(c)}</td>
                      <td className="px-2.5 py-1 text-right">{w.fx.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[var(--lg-mute)]">
        ที่มา: รายงานราคาดัชนีรายสัปดาห์ของกรุงไทย-แอกซา (ระดับดัชนีทุกวันจันทร์ อัตราแลกเปลี่ยนตามธนาคารแห่งประเทศไทย) · แอปตรวจไฟล์ใหม่ทุกวัน ·{" "}
        <a href={REPORT_PAGE} target="_blank" rel="noopener noreferrer" className="text-[var(--lg-gold)] underline underline-offset-4">ดูต้นทางที่กรุงไทย-แอกซา ↗</a>
      </p>
    </section>
  );
}

/** a step that puts four to six grid lines across the weeks' range */
function gridStep(span: number): number {
  for (const s of [0.5, 1, 2, 5, 10, 20, 50]) if (span / s <= 6) return s;
  return 100;
}

function WeekChart({ weeks }: { weeks: IndexWeek[] }) {
  const levels = weeks.map((w) => w.level);
  const step = gridStep(Math.max(...levels) - Math.min(...levels) || 1);
  const yMin = Math.floor(Math.min(...levels) / step) * step;
  const yMax = Math.max(Math.ceil(Math.max(...levels) / step) * step, yMin + step);
  const W = 640, H = 210, L = 44, R = 16, T = 22, B = 28, last = weeks.length - 1;
  const X = (i: number) => L + (last ? i / last : 0.5) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const d = weeks.map((w, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(w.level).toFixed(1)}`).join(" ");
  const grid: number[] = [];
  for (let g = yMin; g <= yMax + 1e-9; g += step) grid.push(Number(g.toFixed(2)));
  /** four date labels spread along the line, the last one under the newest week */
  const ticks = [...new Set([0, Math.round(last / 3), Math.round(last * 2 / 3), last])];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img"
         aria-label={`ราคาดัชนีรายสัปดาห์ ${Math.min(...levels).toFixed(2)} ถึง ${Math.max(...levels).toFixed(2)} จุด ล่าสุด ${weeks[last].level.toFixed(2)} จุด`}>
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="var(--lg-hair)" />
          <text x={L - 8} y={Y(g) + 4} fontSize="11" fill="var(--lg-mute)" textAnchor="end">{step < 1 ? g.toFixed(1) : g}</text>
        </g>
      ))}
      {ticks.map((i) => (
        <text key={i} x={X(i)} y={H - 8} fontSize="11" fill="var(--lg-mute)" textAnchor={i === last && last ? "end" : i === 0 && last ? "start" : "middle"}>{day(weeks[i].date)}</text>
      ))}
      <path d={`${d} L${X(last)} ${Y(yMin)} L${X(0)} ${Y(yMin)} Z`} fill="var(--bot-navy-soft)" opacity="0.7" />
      <path d={d} fill="none" stroke="var(--bot-navy)" strokeWidth="2.2" strokeLinejoin="round" />
      {weeks.length <= 20 && weeks.map((w, i) => <circle key={w.date} cx={X(i)} cy={Y(w.level)} r="2.6" fill="var(--bot-navy)" />)}
      <circle cx={X(last)} cy={Y(weeks[last].level)} r="5" fill="var(--bot-navy)" />
      <text x={X(last) - 8} y={Y(weeks[last].level) - 10} fontSize="12" fontWeight="600" fill="var(--bot-navy)" textAnchor="end">
        {weeks[last].level.toFixed(2)}
      </text>
    </svg>
  );
}
