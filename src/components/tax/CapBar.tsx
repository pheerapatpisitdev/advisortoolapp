import { formatMoney } from '@/lib/tax/money';

interface Props {
  claimed: number;
  allowed: number;
  cap: number | null;
  note?: string;
}

/** แถบ "ใช้ไป X จากสิทธิ์ Y" ใต้ช่องกรอกค่าลดหย่อน */
export function CapBar({ claimed, allowed, cap, note }: Props) {
  if (cap === null || cap <= 0) return null;
  const pct = Math.min(100, (allowed / cap) * 100);
  const cut = claimed > allowed;
  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-tx-surface-2">
        <div className="h-full rounded-full bg-tx-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="num text-xs text-tx-muted">
        ใช้สิทธิ์ {formatMoney(allowed)} จากสิทธิ์สูงสุด {formatMoney(cap)} บาท
        {cut && <span className="text-tx-pay"> · นับได้แค่ {formatMoney(allowed)} บาท</span>}
      </p>
      {cut && note && <p className="text-xs text-tx-pay">{note}</p>}
    </div>
  );
}
