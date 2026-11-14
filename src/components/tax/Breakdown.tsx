import { formatMoney } from '@/lib/tax/money';

export interface BreakdownRow {
  label: string;
  amount: number;
  sign?: '+' | '−' | '=';
  note?: string;
  strong?: boolean;
  indent?: boolean;
}

export function Breakdown({ rows }: { rows: BreakdownRow[] }) {
  return (
    <dl className="divide-y divide-tx-line">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-baseline justify-between gap-4 py-2 ${r.indent ? 'pl-4 text-sm text-tx-muted' : ''}`}>
          <dt className={r.strong ? 'font-semibold' : ''}>
            {r.label}
            {r.note && <span className="block text-xs text-tx-muted">{r.note}</span>}
          </dt>
          <dd className={`num shrink-0 ${r.strong ? 'text-lg font-semibold' : ''}`}>
            {r.sign && r.sign !== '+' ? `${r.sign} ` : ''}
            {formatMoney(r.amount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
