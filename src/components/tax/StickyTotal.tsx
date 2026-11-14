import { formatMoney } from '@/lib/tax/money';

/** แถบล่างติดจอ แสดงภาษีโดยประมาณตลอดเวลาที่กรอก (sticky, not fixed: the app's menu stands to its left) */
export function StickyTotal({ tax, balance, action }: { tax: number; balance: number; action?: React.ReactNode }) {
  const text =
    balance > 0 ? `ต้องจ่ายเพิ่ม ${formatMoney(balance)}` : balance < 0 ? `ได้คืน ${formatMoney(-balance)}` : 'ไม่ต้องจ่ายเพิ่ม';
  const tone = balance > 0 ? 'text-tx-pay' : 'text-tx-refund';
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-tx-line bg-tx-surface/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-tx-muted">ภาษีทั้งปีโดยประมาณ</p>
          <p className="num truncate">
            <span className="text-lg font-bold">{formatMoney(tax)}</span> <span className="text-sm text-tx-muted">บาท</span>
            <span className={`ml-2 text-sm font-medium ${tone}`}>{text}</span>
          </p>
        </div>
        {action}
      </div>
    </div>
  );
}
