"use client";
import { useState, type ReactNode } from "react";
import { formatBaht } from "@/calc/money";
import type { Projection, ProjectionRow } from "@/lib/cash-projection";
import { ageTicks } from "@/lib/age-ticks";

const HEADING = "ความคุ้มครอง เบี้ย และมูลค่าเงินสด";

const W = 340, H = 190, LEFT = 46, RIGHT = 8, TOP = 12, BOTTOM = 24;

const GOLD = "var(--lg-gold)";
/* Named for what they draw, not for a colour: on the ivory sales theme neither is grey. */
const PAID = "var(--lg-series-paid)";
const COVER = "var(--lg-series-cover)";

/** 1,112,000 → "1.1 ล้าน". The vertical axis carries two labels, so they must read at a glance. */
function short(baht: number): string {
  if (baht >= 1_000_000) {
    const m = baht / 1_000_000;
    return `${m % 1 ? m.toFixed(1) : m.toFixed(0)} ล้าน`;
  }
  if (baht >= 100_000) return `${Math.round(baht / 100_000)} แสน`;
  return baht.toLocaleString("en-US");
}

export interface CashValueChartProps {
  projection: Projection;
  /** the insured's age at issue — where the horizontal axis starts */
  age: number;
  /**
   * The copy for the printed sheet, which `CashValueTable` draws under its letterhead: held
   * at the break-even year, with the legend beside the drawing rather than above it and no
   * invitation to drag. The interactive one is then the screen's alone, so a full-page print
   * carries the chart once.
   */
  onPaper?: boolean;
}

/**
 * The gold line is what the policy is worth, the grey one what it has cost, the dashed one
 * what the family would receive. Where gold overtakes grey is the answer to the question
 * customers ask out loud.
 *
 * Dragging across it reads out any single year. The readout sits above the drawing rather
 * than floating beside the finger, because on a phone the finger covers the very point being
 * asked about — and a panel that stays put is one an agent can read aloud while the customer
 * scrubs.
 */
export function CashValueChart({ projection, age, onPaper = false }: CashValueChartProps) {
  const { rows, breakEven, maturityAge, coverFloor } = projection;
  // opening on the break-even year shows the readout working and names the year that matters
  const opening = breakEven ? breakEven.policyYear - 1 : rows.length - 1;
  const [picked, setPicked] = useState(opening);
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

  /**
   * One gridline, at the sum assured — the number the customer picked, and the level the
   * cover steps down to at 60 before any top-up for premiums paid. Skipped when it would sit
   * on top of an axis label it would otherwise explain.
   */
  const grid = coverFloor < top * 0.92 && coverFloor > top * 0.08 ? coverFloor : null;

  // every tenth birthday, as on the card; 18 units is a two-digit label at this size and a gap
  const ticks = ageTicks(age, maturityAge, x, 18);

  /** which year a touch anywhere in the drawing is asking about */
  const pickFrom = (clientX: number, box: DOMRect) => {
    const inView = ((clientX - box.left) / box.width) * W;
    const at = ((inView - LEFT) / (W - LEFT - RIGHT)) * (maturityAge - age) + age;
    setPicked(Math.max(0, Math.min(rows.length - 1, Math.round(at - age))));
  };

  /**
   * The break-even, ringed where the cash line crosses the paid line. Only on a plan that
   * hands nothing back along the way: there the projection counts the instalments already
   * received, the drawn line does not, and a ring sitting below the paid line would contradict
   * the very sentence it stands for.
   */
  const paysAlong = rows.slice(0, -1).some((r) => r.payout);
  const mark = breakEven && !paysAlong ? breakEven : null;

  /**
   * Each line named for what it means to the family first, the company's own term after it:
   * "มูลค่าเวนคืนเงินสด" is the word on the contract, and the one a customer cannot read.
   */
  const readout: [string, string, string, number | null][] = [
    ["เงินที่จ่ายไปแล้ว", "เบี้ยสะสม", PAID, here.premiumPaid],
    ["เงินคืนถ้ายกเลิก", "มูลค่าเวนคืน", GOLD, here.cashValue],
    ["ครอบครัวได้รับถ้าเสียชีวิต", "ความคุ้มครอง", COVER, here.cover],
  ];

  const legend = (
    <dl className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] px-3 py-2.5">
      <div className="mb-2 border-b border-[var(--lg-panel-line)] pb-1.5 text-xs font-medium text-[var(--lg-white)]">
        อายุ {here.age} ปี · สิ้นปีที่ {here.policyYear}
      </div>
      {readout.map(([label, term, colour, value]) => value === null ? null : (
        <div key={label} className="flex items-baseline justify-between gap-3 py-0.5">
          <dt className="flex items-center gap-2 text-xs text-[var(--lg-mute)]">
            {/* a background, which paper drops unless told otherwise — and on paper these
                dots are the only key to which line is which */}
            <i
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: colour, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />
            <span>
              {label}
              <span className="ml-1 text-[10px] opacity-70">({term})</span>
            </span>
          </dt>
          <dd className="text-sm tabular-nums text-[var(--lg-white)]">{formatBaht(value)}</dd>
        </div>
      ))}
    </dl>
  );

  const drawing = (
    <svg
      viewBox={`0 0 ${W} ${H}`} width="100%" role="img" tabIndex={0}
      aria-label={`กราฟความคุ้มครองชีวิต เบี้ยที่จ่ายสะสม และมูลค่าเวนคืนเงินสด ตั้งแต่อายุ ${age} ถึง ${maturityAge} ปี${
        breakEven ? ` มูลค่าเวนคืนเท่ากับเบี้ยที่จ่ายเมื่ออายุ ${breakEven.age} ปี` : ""
      } ใช้ปุ่มลูกศรซ้ายขวาเพื่อดูทีละปี`}
      className="mt-2 block touch-none select-none overflow-visible focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--lg-gold)]"
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
      <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
      <line x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
      <text x={LEFT - 6} y={y(top) + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">
        {short(Math.round(top / 100))}
      </text>
      <text x={LEFT - 6} y={H - BOTTOM + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">0</text>
      {grid !== null && (
        <>
          <line x1={LEFT} y1={y(grid)} x2={W - RIGHT} y2={y(grid)} stroke="var(--lg-panel-line)" />
          <text x={LEFT - 6} y={y(grid) + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">
            {short(Math.round(grid / 100))}
          </text>
        </>
      )}
      <text x={LEFT - 6} y={H - 8} fill="var(--lg-mute)" fontSize="9" textAnchor="end">อายุ</text>
      {ticks.map((at) => (
        <text key={at} x={x(at)} y={H - 8} fill="var(--lg-mute)" fontSize="10" textAnchor="middle">{at}</text>
      ))}

      <line
        x1={x(here.age)} y1={TOP - 4} x2={x(here.age)} y2={H - BOTTOM}
        stroke="var(--lg-mute)" strokeWidth="1" strokeDasharray="3 3"
      />

      {/* the money growing is the story, so the space under it is tinted */}
      <polygon
        fill={GOLD} fillOpacity="0.08" stroke="none"
        points={`${x(age).toFixed(1)},${y(0).toFixed(1)} ${path((r) => r.cashValue)} ${x(rows[rows.length - 1].age).toFixed(1)},${y(0).toFixed(1)}`}
      />
      <polyline fill="none" stroke={COVER} strokeWidth="1.5" strokeDasharray="4 3" points={coverPath} />
      {here.premiumPaid !== null && (
        <polyline fill="none" stroke={PAID} strokeWidth="1.5" strokeLinejoin="round" points={path((r) => r.premiumPaid!)} />
      )}
      <polyline fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" points={path((r) => r.cashValue)} />

      {mark && (
        <g>
          <circle cx={x(mark.age)} cy={y(mark.cashValue)} r="6" fill="none" stroke={GOLD} strokeWidth="1.25" />
          <text
            x={x(mark.age)} y={y(mark.cashValue) + 16} fill={GOLD} fontSize="9" fontWeight="600"
            textAnchor={x(mark.age) > W - 60 ? "end" : "middle"}
          >
            จุดคุ้มทุน · อายุ {mark.age}
          </text>
        </g>
      )}

      {([["cover", here.cover, COVER], ["paid", here.premiumPaid, PAID], ["cash", here.cashValue, GOLD]] as [string, number | null, string][])
        .map(([key, value, colour]) => value === null ? null : (
          <circle
            key={key} cx={x(here.age)} cy={y(value)} r="3.5"
            fill={colour} stroke="var(--lg-ground-deep)" strokeWidth="1.5"
          />
        ))}
    </svg>
  );

  if (onPaper) {
    return (
      <div className="mb-4 break-inside-avoid">
        <p className="text-sm font-semibold">{HEADING}</p>
        <div className="mt-2 flex items-start gap-5">
          <div className="w-[62%] shrink-0">{drawing}</div>
          <div className="min-w-0 flex-1">{legend}</div>
        </div>
      </div>
    );
  }

  return (
    <div data-screen-only className="mt-4">
      <div className="text-sm text-[var(--lg-mute)]">{HEADING}</div>
      <div className="mt-2">
        {legend}
        {drawing}
        <div className="mt-1.5 text-center text-[11px] text-[var(--lg-mute)] opacity-70">
          แตะหรือลากบนกราฟ เพื่อดูตัวเลขของแต่ละปี
        </div>
        <ReadingGuide projection={projection} age={age} paysAlong={paysAlong} />
      </div>
    </div>
  );
}

/** a short sample of a series' line, so the guide points at a line by its look, not a colour name */
function Swatch({ colour, dashed = false }: { colour: string; dashed?: boolean }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="mt-1 shrink-0">
      <line
        x1="1" y1="5" x2="21" y2="5" stroke={colour} strokeWidth={dashed ? 2 : 2.5}
        strokeDasharray={dashed ? "4 3" : undefined} strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The chart read aloud, for the customer who has never read one: what each line is, which way
 * is good, and the two or three ages worth remembering — every number taken from this
 * contract, so an agent can point at the sentence and then at the line it describes.
 */
function ReadingGuide({ projection, age, paysAlong }: { projection: Projection; age: number; paysAlong: boolean }) {
  const { rows, breakEven, maturityAge } = projection;
  const last = rows[rows.length - 1];
  const paidOff = rows.find((r) => r.premiumDue === 0);
  const dropsAt = rows.find((r, i) => i > 0 && r.cover < rows[i - 1].cover * 0.9);

  const items: [ReactNode, ReactNode][] = [
    [
      <Swatch key="s" colour={GOLD} />,
      <>
        <b>เส้นทึบเข้ม = เงินคืนถ้ายกเลิกกรมธรรม์</b> เส้นยิ่งชี้ขึ้น แปลว่าเงินในกรมธรรม์ยิ่งงอกเงยขึ้นทุกปี
        {last.cashValue > 0 && <> — ถืออยู่จนอายุ {maturityAge} มีมูลค่า {formatBaht(last.cashValue)}</>}
      </>,
    ],
  ];
  if (last.premiumPaid !== null) {
    items.push([
      <Swatch key="s" colour={PAID} />,
      <>
        <b>เส้นทึบเทา = เงินที่จ่ายเบี้ยไปรวมทั้งหมด</b>
        {paidOff
          ? <> ไต่ขึ้นช่วงที่ยังจ่ายเบี้ย แล้ว<b>แบนราบตั้งแต่อายุ {paidOff.age}</b> เพราะจ่ายครบแล้ว รวม {formatBaht(last.premiumPaid)}</>
          : <> รวมทั้งสัญญา {formatBaht(last.premiumPaid)}</>}
      </>,
    ]);
    items.push([
      <span key="s" className="mt-0.5 shrink-0 text-sm leading-none">✓</span>,
      breakEven ? (
        <>
          <b>จุดสำคัญ: ตั้งแต่อายุ {breakEven.age}</b>{" "}
          {paysAlong
            ? <>เงินคืน รวมกับเงินที่ทยอยได้รับระหว่างทาง มากกว่าเงินที่จ่ายไป</>
            : <>เส้นเข้มขึ้นไปอยู่เหนือเส้นเทา แปลว่าถ้ายกเลิก ได้เงินคืนมากกว่าที่จ่ายไป</>}
        </>
      ) : (
        <>
          <b>แผนนี้เน้นความคุ้มครอง</b> เงินคืนถ้ายกเลิกจะน้อยกว่าเงินที่จ่ายไป
          ส่วนที่เหลือคือค่าความคุ้มครองตลอดสัญญา
        </>
      ),
    ]);
  }
  items.push([
    <Swatch key="s" colour={COVER} dashed />,
    <>
      <b>เส้นประ = เงินที่ครอบครัวได้รับ ถ้าผู้เอาประกันเสียชีวิต</b>{" "}
      {dropsAt
        ? <>{formatBaht(rows[0].cover)} ช่วงอายุ {age}–{dropsAt.age - 1} แล้วเป็น {formatBaht(dropsAt.cover)} ตั้งแต่อายุ {dropsAt.age}</>
        : <>อย่างน้อย {formatBaht(rows[0].cover)} ตลอดสัญญา</>}
    </>,
  ]);

  return (
    <div className="mt-3 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] px-3 py-2.5">
      <div className="mb-1.5 text-xs font-medium text-[var(--lg-white)]">วิธีอ่านกราฟนี้</div>
      <ul className="space-y-1.5">
        {items.map(([mark, text], i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--lg-mute)] [&_b]:font-medium [&_b]:text-[var(--lg-white)]">
            {mark}
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
