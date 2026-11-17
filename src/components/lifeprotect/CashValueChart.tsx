"use client";
import { useId, useState } from "react";
import { formatBaht } from "@/calc/money";
import type { Projection, ProjectionRow } from "@/lib/cash-projection";
import { shortBaht } from "@/lib/short-baht";

const HEADING = "ความคุ้มครอง เบี้ย และมูลค่าเงินสด";

/* TOP leaves room for the age pill that rides above the picked year. */
const W = 340, H = 208, LEFT = 46, RIGHT = 10, TOP = 24, BOTTOM = 22;

const GOLD = "var(--lg-gold)";
/* Named for what they draw, not for a colour: on the ivory sales theme neither is grey. */
const PAID = "var(--lg-series-paid)";
const COVER = "var(--lg-series-cover)";

/** keeps the dot colours on paper, where backgrounds are otherwise dropped */
const INK = { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as const;

export interface CashValueChartProps {
  projection: Projection;
  /** the insured's age at issue — where the horizontal axis starts */
  age: number;
  /**
   * The copy for the printed sheet, which `CashValueTable` draws under its letterhead: held
   * at the break-even year, with the readout beside the drawing rather than above it and no
   * invitation to drag. The interactive one is then the screen's alone, so a full-page print
   * carries the chart once.
   */
  onPaper?: boolean;
}

/**
 * A step of 2.5 แสน for a 1 ล้าน contract, 5 แสน for 2 ล้าน: two to four faint lines, each at
 * an amount a person would say out loud. In satang, as the rows are.
 */
function gridStep(top: number): number {
  const baht = top / 100;
  for (const s of [10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000, 2_500_000, 5_000_000, 10_000_000]) {
    if (baht / s <= 4) return s * 100;
  }
  return Math.ceil(baht / 4) * 100;
}

/**
 * The ages written under the drawing (owner, 2026-11-17: "อายุแบบละเอียด"): every fifth
 * birthday, or every tenth where five years would crowd two-digit labels together, plus the
 * age quoted and the age the contract ends. A label too near either end is dropped rather
 * than printed on top of it.
 */
function labelledAges(from: number, to: number, x: (at: number) => number, gap: number): number[] {
  const step = x(from + 5) - x(from) >= gap ? 5 : 10;
  const kept = [from];
  for (let a = Math.ceil((from + 1) / step) * step; a < to; a += step) {
    if (x(a) - x(kept[kept.length - 1]) < gap || x(to) - x(a) < gap) continue;
    kept.push(a);
  }
  if (to > from) kept.push(to);
  return kept;
}

/**
 * The navy line is what the policy is worth, the grey one what it has cost, the dashed one
 * what the family would receive. The cash value leads (design ข, owner 2026-11-17): its figure
 * is set large above the drawing and the ground under its line is tinted, the other two are
 * read from small chips.
 *
 * Dragging across it reads out any single year. The readout sits above the drawing rather
 * than floating beside the finger, because on a phone the finger covers the very point being
 * asked about — and a panel that stays put is one an agent can read aloud while the customer
 * scrubs.
 */
export function CashValueChart({ projection, age, onPaper = false }: CashValueChartProps) {
  const { rows, breakEven, maturityAge } = projection;
  // opening on the break-even year shows the readout working and names the year that matters
  const opening = breakEven ? breakEven.policyYear - 1 : rows.length - 1;
  const [picked, setPicked] = useState(opening);
  // two copies can share a page (screen and print), so the gradient's id is the instance's own
  const fillId = `cv-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!rows.length) return null;

  // the paper copy holds no year of its own: it is redrawn for every contract, unkeyed
  const here = rows[Math.min(onPaper ? opening : picked, rows.length - 1)];
  const top = Math.max(...rows.map((r) => Math.max(r.cover, r.cashValue, r.premiumPaid ?? 0))) || 1;
  const x = (at: number) => LEFT + ((at - age) / (maturityAge - age)) * (W - LEFT - RIGHT);
  const y = (satang: number) => H - BOTTOM - (satang / top) * (H - BOTTOM - TOP);
  const path = (pick: (r: ProjectionRow) => number) =>
    rows.map((r) => `${x(r.age).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");

  /**
   * The cover holds all year and then drops on one birthday, so it is drawn as a step — a
   * sloped line between two years would say the family loses it gradually, which is not what
   * the policy does.
   */
  const coverPath = rows
    .flatMap((r) => [`${x(r.age).toFixed(1)},${y(r.cover).toFixed(1)}`, `${x(r.age + 1).toFixed(1)},${y(r.cover).toFixed(1)}`])
    .join(" ");

  const cashArea = `${x(rows[0].age).toFixed(1)},${y(0)} ${path((r) => r.cashValue)} ${x(rows[rows.length - 1].age).toFixed(1)},${y(0)}`;

  // faint lines at round amounts; every other one labelled, counting down from the highest
  const step = gridStep(top);
  const lines: number[] = [];
  for (let v = step; v <= top + 1; v += step) lines.push(v);
  const labelled = new Set(lines.filter((_, i) => (lines.length - 1 - i) % 2 === 0));

  // 16 units clears a two-digit label at this size with a little air
  const ages = labelledAges(age, maturityAge, x, 16);
  const years: number[] = [];
  for (let a = age; a <= maturityAge; a++) years.push(a);

  /** which year a touch anywhere in the drawing is asking about */
  const pickFrom = (clientX: number, box: DOMRect) => {
    const inView = ((clientX - box.left) / box.width) * W;
    const at = ((inView - LEFT) / (W - LEFT - RIGHT)) * (maturityAge - age) + age;
    setPicked(Math.max(0, Math.min(rows.length - 1, Math.round(at - age))));
  };

  const pillX = Math.max(LEFT + 20, Math.min(W - RIGHT - 20, x(here.age)));

  const readout = (
    <div>
      <div className="text-xs text-[var(--lg-mute)]">
        มูลค่าเวนคืนเงินสด · อายุ {here.age} ปี (สิ้นปีที่ {here.policyYear})
      </div>
      <div className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-[var(--lg-gold)]">
        {formatBaht(here.cashValue)}
        <span className="ml-1 text-[15px] font-medium">บาท</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([["เบี้ยสะสม", PAID, here.premiumPaid], ["ความคุ้มครองเสียชีวิต", COVER, here.cover]] as [string, string, number | null][])
          .map(([label, colour, value]) => value === null ? null : (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lg-panel)] px-2.5 py-0.5 text-xs text-[var(--lg-mute)]"
              style={INK}
            >
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: colour, ...INK }} />
              {label}
              <b className="font-semibold tabular-nums text-[var(--lg-white)]">{formatBaht(value)}</b>
            </span>
          ))}
      </div>
    </div>
  );

  const drawing = (
    <svg
      viewBox={`0 0 ${W} ${H}`} width="100%" role="img" tabIndex={0}
      aria-label={`กราฟความคุ้มครองชีวิต เบี้ยที่จ่ายสะสม และมูลค่าเวนคืนเงินสด ตั้งแต่อายุ ${age} ถึง ${maturityAge} ปี${
        breakEven ? ` มูลค่าเวนคืนเท่ากับเบี้ยที่จ่ายเมื่ออายุ ${breakEven.age} ปี` : ""
      } ใช้ปุ่มลูกศรซ้ายขวาเพื่อดูทีละปี`}
      // a click must not leave the browser's blue ring round the drawing; the keyboard keeps a ring
      className="mt-2 block touch-none select-none overflow-visible [&:focus:not(:focus-visible)]:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lg-gold)]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pickFrom(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onPointerMove={(e) => {
        // a mouse reads out on hover; a finger only while it is down
        if (e.buttons === 0 && e.pointerType !== "mouse") return;
        pickFrom(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        setPicked((i) => Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowRight" ? 1 : -1))));
      }}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: GOLD, stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: GOLD, stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {lines.map((v) => (
        <g key={v}>
          <line x1={LEFT} y1={y(v)} x2={W - RIGHT} y2={y(v)} stroke="var(--lg-hair)" strokeOpacity="0.45" />
          {labelled.has(v) && (
            <text x={LEFT - 8} y={y(v) + 3.5} fill="var(--lg-mute)" fontSize="9.5" textAnchor="end">
              {shortBaht(Math.round(v / 100))}
            </text>
          )}
        </g>
      ))}
      <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} stroke="var(--lg-hair)" />
      <text x={LEFT - 8} y={H - BOTTOM + 3.5} fill="var(--lg-mute)" fontSize="9.5" textAnchor="end">0</text>

      {/* a small tick on every birthday, a longer one under each labelled age */}
      {years.map((a) => {
        const long = ages.includes(a);
        return (
          <line
            key={a} x1={x(a)} y1={H - BOTTOM} x2={x(a)} y2={H - BOTTOM + (long ? 5 : 2.5)}
            stroke={long ? "var(--lg-panel-line)" : "var(--lg-hair)"} strokeWidth={long ? 1 : 0.75}
          />
        );
      })}
      {ages.map((a) => (
        <text
          key={a} x={x(a)} y={H - BOTTOM + 16} fontSize="10" textAnchor="middle"
          fill={a === here.age ? GOLD : "var(--lg-mute)"} fontWeight={a === here.age ? 700 : 400}
        >
          {a}
        </text>
      ))}

      <polygon points={cashArea} fill={`url(#${fillId})`} />

      <line x1={x(here.age)} y1={TOP - 4} x2={x(here.age)} y2={H - BOTTOM} stroke={GOLD} strokeOpacity="0.3" />

      <polyline fill="none" stroke={COVER} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" points={coverPath} />
      {here.premiumPaid !== null && (
        <polyline
          fill="none" stroke={PAID} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          points={path((r) => r.premiumPaid!)}
        />
      )}
      <polyline fill="none" stroke={GOLD} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={path((r) => r.cashValue)} />

      {here.premiumPaid !== null && (
        <circle cx={x(here.age)} cy={y(here.premiumPaid)} r="3.5" fill={PAID} stroke="var(--lg-ground)" strokeWidth="2" />
      )}
      <circle cx={x(here.age)} cy={y(here.cashValue)} r="5.5" fill={GOLD} stroke="var(--lg-ground)" strokeWidth="2" />

      <rect x={pillX - 21} y={TOP - 20} width="42" height="16" rx="8" fill={GOLD} />
      <text x={pillX} y={TOP - 8.5} fill="var(--lg-ground)" fontSize="10" fontWeight="600" textAnchor="middle">
        อายุ {here.age}
      </text>
    </svg>
  );

  if (onPaper) {
    return (
      <div className="mb-4 break-inside-avoid">
        <p className="text-sm font-semibold">{HEADING}</p>
        <div className="mt-2 flex items-start gap-5">
          <div className="w-[62%] shrink-0">{drawing}</div>
          <div className="min-w-0 flex-1 pt-2">{readout}</div>
        </div>
      </div>
    );
  }

  return (
    <div data-screen-only className="mt-4">
      <div className="text-sm text-[var(--lg-mute)]">{HEADING}</div>
      <div className="mt-2">
        {readout}
        {drawing}
        <div className="mt-1.5 text-center text-[11px] text-[var(--lg-mute)] opacity-70">
          ลากบนกราฟเพื่อดูตัวเลขของปีอื่น
        </div>
      </div>
    </div>
  );
}
