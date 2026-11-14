import type { BracketLine } from '@/lib/tax/brackets';
import { formatMoney } from '@/lib/tax/money';

const SHADES = ['var(--tx-bar-0)', 'var(--tx-bar-1)', 'var(--tx-bar-2)', 'var(--tx-bar-3)', 'var(--tx-bar-4)', 'var(--tx-bar-5)', 'var(--tx-bar-5)', 'var(--tx-bar-5)'];

/** แสดงว่าเงินได้สุทธิแต่ละก้อนเสียภาษีกี่เปอร์เซ็นต์ */
export function BracketChart({ lines, unit = 'เงินได้สุทธิ' }: { lines: BracketLine[]; unit?: string }) {
  if (lines.length === 0) {
    return <p className="text-sm text-tx-muted">ยังไม่มี{unit}ที่ต้องเสียภาษี</p>;
  }
  const max = Math.max(...lines.map((l) => l.amount));
  return (
    <ol className="space-y-2.5">
      {lines.map((l, i) => (
        <li key={l.from} className="grid grid-cols-[3.25rem_1fr] items-center gap-3">
          <span className="num text-right text-sm font-semibold">{l.rate === 0 ? 'ยกเว้น' : `${Math.round(l.rate * 100)}%`}</span>
          <div className="min-w-0">
            <div className="h-6 rounded-md" style={{ width: `${Math.max(4, (l.amount / max) * 100)}%`, background: SHADES[i] }} />
            <p className="num mt-0.5 text-xs text-tx-muted">
              {formatMoney(l.from)}–{l.to === null ? 'ขึ้นไป' : formatMoney(l.to)}: ก้อนนี้ {formatMoney(l.amount)} บาท →{' '}
              <span className="font-semibold text-tx-ink">ภาษี {formatMoney(l.tax)}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
