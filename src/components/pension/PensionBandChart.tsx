import type { PensionBand } from "@/calc/pension/engine";

/**
 * The pension by age band as a staircase: each bar as wide as the years it is paid and as tall
 * as the yearly pension, so the reader sees how much and for how long at once (owner,
 * 2026-10-14, option ข on mockup https://claude.ai/artifact/Wo6BYj7F14MCZKQPP7Yetq). It
 * replaced a table of the same figures; every bar still carries its own numbers.
 */
const W = 320;
const LEFT = 8;
const RIGHT = 312;
const BASE = 180;
const TALLEST = 140;

const baht = (n: number) => Math.floor(n).toLocaleString("en-US");

export function PensionBandChart({ bands }: { bands: PensionBand[] }) {
  if (bands.length === 0) return null;
  const years = (b: PensionBand) => b.toAge - b.fromAge + 1;
  const total = bands.reduce((s, b) => s + years(b), 0);
  const top = Math.max(...bands.map((b) => b.annual));
  const perYear = (RIGHT - LEFT) / total;
  const GAP = 2;

  let x = LEFT;
  const bars = bands.map((b) => {
    const width = years(b) * perYear;
    const height = (b.annual / top) * TALLEST;
    const bar = { b, x: x + (x === LEFT ? 0 : GAP / 2), width: width - (x === LEFT ? GAP / 2 : GAP), height };
    x += width;
    return { ...bar, mid: bar.x + bar.width / 2 };
  });

  return (
    <figure className="m-0 grid gap-1">
      <figcaption className="text-sm text-[var(--op-mute)]">บำนาญต่อปี ตามช่วงอายุ</figcaption>
      <svg viewBox={`0 0 ${W} 222`} className="w-full" role="img"
        aria-label={bands.map((b) => `อายุ ${b.fromAge}–${b.toAge} ปีละ ${baht(b.annual)} บาท (${Math.round(b.percent * 100)}% ของทุน)`).join(" · ")}>
        <line x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} stroke="var(--op-line)" />
        {bars.map(({ b, x: bx, width, height, mid }) => (
          <g key={b.fromAge}>
            <title>{`อายุ ${b.fromAge}–${b.toAge}: ปีละ ${baht(b.annual)} บาท`}</title>
            <rect x={bx} y={BASE - height} width={width} height={height} rx={2} fill="var(--op-accent)" />
            <text x={mid} y={BASE - height - 7} textAnchor="middle" fontSize={11} fontWeight={600}
              fill="var(--op-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{baht(b.annual)}</text>
            <text x={mid} y={BASE - 30} textAnchor="middle" fontSize={10.5} fill="var(--lg-ground)">
              {Math.round(b.percent * 100)}%
            </text>
            <text x={mid} y={BASE + 16} textAnchor="middle" fontSize={10.5} fill="var(--op-mute)"
              style={{ fontVariantNumeric: "tabular-nums" }}>{b.fromAge}–{b.toAge}</text>
            <text x={mid} y={BASE + 32} textAnchor="middle" fontSize={10.5} fill="var(--op-mute)">{years(b)} ปี</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
