import {
  INDEX_ALLOCATION, INDEX_ANNUAL_RETURNS, INDEX_BASE_YEAR, INDEX_EVENTS, INDEX_LINK, INDEX_METRICS, INDEX_NAME, indexLevels,
} from "@/calc/global-saving/factsheet";

/**
 * The index the plan's bonus follows, under the calculator (owner, ก, 2026-10-20): its three
 * headline figures, what it holds, its level since 2545 and its return each year. Drawn as
 * plain SVG on the page's tokens, so it needs no chart library and prints in the same ink.
 */

/** each asset group in its own family of the app's colours: equities navy, government bonds green, credit violet, commodities sand */
const GROUP_COLOURS: Record<string, string[]> = {
  "หุ้น": ["var(--bot-navy)", "#2a4f9a", "#6f8fd0"],
  "พันธบัตรรัฐบาล": ["var(--bot-ok)", "#5f8c72", "var(--bot-ok-line)"],
  "ตราสารหนี้เอกชน": ["#5c4b8a"],
  "โภคภัณฑ์": ["var(--bot-sand-line)", "var(--bot-sand)"],
};

const pct2 = (n: number) => n.toFixed(2);

export function IndexFactsheet() {
  let acc = 0;
  const stops: string[] = [];
  const groups = INDEX_ALLOCATION.map((g) => ({
    ...g,
    total: g.items.reduce((s, i) => s + i.pct, 0),
    items: g.items.map((it, k) => {
      const colour = GROUP_COLOURS[g.name]?.[k] ?? "var(--lg-mute)";
      stops.push(`${colour} ${acc}% ${acc + it.pct}%`);
      acc += it.pct;
      return { ...it, colour };
    }),
  }));
  const count = INDEX_ALLOCATION.reduce((s, g) => s + g.items.length, 0);

  return (
    <section className="mt-10 space-y-5 border-t border-[var(--lg-hair)] pt-8" aria-labelledby="gs-index">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-[var(--lg-mute)]">ดัชนีอ้างอิงของแบบนี้ · หลายสินทรัพย์ ควบคุมความผันผวน</p>
          <h2 id="gs-index" className="text-xl font-semibold">{INDEX_NAME}</h2>
        </div>
        <dl className="flex flex-wrap gap-6">
          <Metric value={`${pct2(INDEX_METRICS.avgReturn)}%`} label="ผลตอบแทนเฉลี่ยต่อปี" />
          <Metric value={`${pct2(INDEX_METRICS.avgVolatility)}%`} label="ความผันผวนเฉลี่ยต่อปี" />
          <Metric value={pct2(INDEX_METRICS.sharpe)} label="Sharpe ratio" />
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[5fr_7fr]">
        <div className="rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
          <h3 className="text-base font-semibold">สัดส่วนการลงทุนเฉลี่ย</h3>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <div className="relative h-40 w-40 flex-none rounded-full print:[print-color-adjust:exact]"
                 style={{ background: `conic-gradient(${stops.join(",")})` }} role="img"
                 aria-label={groups.map((g) => `${g.name} ${pct2(g.total)}%`).join(" · ")}>
              <div className="absolute inset-[28px] grid place-content-center rounded-full bg-[var(--lg-raise)] text-center text-xs text-[var(--lg-mute)]">
                <b className="text-xl text-[var(--lg-white)]">100%</b>{count} สินทรัพย์
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 text-sm">
              {groups.map((g) => (
                <div key={g.name}>
                  <div className="mt-1.5 text-xs text-[var(--lg-mute)]">{g.name} · {pct2(g.total)}%</div>
                  {g.items.map((it) => (
                    <div key={it.en} className="grid grid-cols-[0.7rem_1fr_auto] items-center gap-2">
                      <i className="h-2.5 w-2.5 print:[print-color-adjust:exact]" style={{ background: it.colour }} />
                      <span>{it.th}</span>
                      <span className="tabular-nums">{pct2(it.pct)}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--lg-mute)]">ข้อมูลเฉลี่ย ม.ค. 2548 – เม.ย. 2569</p>
        </div>

        <div className="rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
          <h3 className="text-base font-semibold">
            ราคาดัชนี <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">เริ่ม 100 จุด ธ.ค. {INDEX_BASE_YEAR}</span>
          </h3>
          <LevelChart />
          <p className="mt-2 text-xs text-[var(--lg-mute)]">
            แถบสีทราย = ช่วงตลาดผันผวน: {INDEX_EVENTS.map((e) => `${e.text} ${e.from === e.to ? e.from : `${e.from}–${String(e.to).slice(2)}`}`).join(" · ")}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
        <h3 className="text-base font-semibold">ผลตอบแทนรายปี <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">% ต่อปี</span></h3>
        <div className="mt-2 overflow-x-auto"><AnnualChart /></div>
        <p className="mt-1 text-xs text-[var(--lg-mute)]">ปี พ.ศ. 2546–2568 (ตัวเลขใต้แท่ง = 2 หลักท้ายของปี)</p>
      </div>

      <p className="text-xs leading-relaxed text-[var(--lg-mute)]">
        ผลการดำเนินงานในอดีตมิได้เป็นสิ่งยืนยันผลในอนาคต · ตัวเลขผลตอบแทนเป็นค่าก่อนปรับด้วยอัตราการมีส่วนร่วมในผลตอบแทน
        · ข้อมูลตั้งแต่ พ.ค. 2565 เป็นผลจริง ก่อนหน้านั้นจำลองย้อนหลัง (Backtesting) · ที่มา: เอกสารข้อมูล {INDEX_NAME} ·{" "}
        <a href={INDEX_LINK} target="_blank" rel="noopener noreferrer" className="text-[var(--lg-gold)] underline underline-offset-4">
          ดูดัชนีเรียลไทม์ที่กรุงไทย-แอกซา ↗
        </a>
      </p>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-[var(--lg-mute)]">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-[var(--lg-gold)]">{value}</dd>
    </div>
  );
}

function LevelChart() {
  const pts = indexLevels();
  const last = pts[pts.length - 1];
  const W = 640, H = 230, L = 40, R = 12, T = 14, B = 26;
  const x0 = INDEX_BASE_YEAR, x1 = last.year, yMin = 90, yMax = 300;
  const X = (y: number) => L + (y - x0) / (x1 - x0) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)} ${Y(p.level).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img"
         aria-label={`ราคาดัชนีจาก 100 จุด ปี ${x0} ถึง ${Math.round(last.level)} จุด ปี ${x1}`}>
      {INDEX_EVENTS.map((e) => (
        <rect key={e.from} x={X(e.from - 1)} y={T} width={X(e.to) - X(e.from - 1)} height={H - T - B} fill="var(--bot-sand-soft)" />
      ))}
      {[100, 150, 200, 250, 300].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="var(--lg-hair)" />
          <text x={L - 6} y={Y(g) + 4} fontSize="11" fill="var(--lg-mute)" textAnchor="end">{g}</text>
        </g>
      ))}
      {[2545, 2550, 2555, 2560, 2565].map((g) => (
        <text key={g} x={X(g)} y={H - 8} fontSize="11" fill="var(--lg-mute)" textAnchor="middle">{g}</text>
      ))}
      <path d={`${d} L${X(x1)} ${Y(yMin)} L${X(x0)} ${Y(yMin)} Z`} fill="var(--bot-navy-soft)" opacity="0.6" />
      <path d={d} fill="none" stroke="var(--bot-navy)" strokeWidth="2.2" />
      <circle cx={X(x1)} cy={Y(last.level)} r="4" fill="var(--bot-navy)" />
      <text x={X(x1) - 8} y={Y(last.level) - 8} fontSize="12" fontWeight="600" fill="var(--bot-navy)" textAnchor="end">
        {Math.round(last.level)} จุด
      </text>
    </svg>
  );
}

function AnnualChart() {
  const years = Object.keys(INDEX_ANNUAL_RETURNS).map(Number).sort((a, b) => a - b);
  const bw = 34, W = years.length * bw + 30, H = 190, zero = 120, k = 8.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} className="max-w-none" role="img"
         aria-label={`ผลตอบแทนรายปี ${years[0]} ถึง ${years[years.length - 1]}`}>
      <line x1="20" x2={W - 6} y1={zero} y2={zero} stroke="var(--lg-panel-line)" />
      {years.map((y, i) => {
        const r = INDEX_ANNUAL_RETURNS[y], cx = 24 + i * bw, h = Math.abs(r) * k, up = r >= 0;
        return (
          <g key={y}>
            <rect x={cx + 4} y={up ? zero - h : zero} width={bw - 8} height={h} fill={up ? "var(--bot-navy)" : "var(--bot-red-ink)"} />
            <text x={cx + bw / 2} y={up ? zero - h - 4 : zero + h + 12} fontSize="10.5" textAnchor="middle"
                  fill={up ? "var(--lg-white)" : "var(--bot-red-ink)"}>
              {r > 0 ? "+" : ""}{r.toFixed(2)}
            </text>
            <text x={cx + bw / 2} y={H - 6} fontSize="10.5" fill="var(--lg-mute)" textAnchor="middle">{String(y).slice(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}
