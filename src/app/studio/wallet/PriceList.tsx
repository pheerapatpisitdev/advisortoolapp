import { perPostUnder } from "@/lib/wallet/money";
import { PRICE_ITEMS, priceBaht, type PriceGroup, type Prices } from "@/lib/wallet/prices";

const GROUPS: { group: PriceGroup; title: string }[] = [
  { group: "video", title: "วิดีโอนำเสนอ" },
  { group: "picture", title: "รูปภาพ" },
];

/**
 * What everything costs from the wallet, as the owner priced it on /admin/wallet (owner,
 * 2026-10-12: "เอาราคา รายการโชว์ให้สมาชิกเห็นด้วย"). The writing rounds and clip editing are
 * still their cost times the multiplier, so they are said as an average and a rule.
 * `id="prices"`: the Studio menu's ราคา lands here.
 */
export function PriceList({ prices, multiplier }: { prices: Prices; multiplier: number }) {
  const row = "flex items-baseline justify-between gap-3 px-4 py-2 text-sm";
  return (
    <section id="prices" className="scroll-mt-20 space-y-2">
      <h2 className="text-sm font-medium">ราคา</h2>
      <div className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)]">
        {GROUPS.map(({ group, title }) => (
          <div key={group}>
            <p className="px-4 pt-3 text-xs font-medium text-[var(--ct-mute)]">{title}</p>
            <ul>
              {PRICE_ITEMS.filter((i) => i.group === group).map((i) => (
                <li key={i.key} className={row}>
                  <span className="min-w-0">{i.label}</span>
                  <b className="shrink-0 tabular-nums">{i.extra ? "+" : ""}฿{priceBaht(prices[i.key])} / {i.unit}</b>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="px-4 pt-3 text-xs font-medium text-[var(--ct-mute)]">เขียนโพสต์ (Organic Studio)</p>
          <ul>
            <li className={row}>
              <span className="min-w-0">เขียนโพสต์, หาทีม, ความรู้, เขียนเอง, ขอบคุณลูกค้า, โชว์ผลงาน, คำคม, รีวิวเคลม</span>
              <b className="shrink-0 tabular-nums">เฉลี่ยไม่ถึง ฿{perPostUnder(multiplier).toFixed(2)} / ชิ้น</b>
            </li>
            <li className={row}>
              <span className="min-w-0">ถอดเสียงและตัดต่อคลิปที่ถ่ายเอง</span>
              <b className="shrink-0">ตามต้นทุนจริง ×{multiplier}</b>
            </li>
          </ul>
        </div>
      </div>
      <p className="text-xs text-[var(--ct-mute)]">ทำไม่สำเร็จไม่เสียเงิน · เงินในกระเป๋าไม่มีวันหมดอายุ</p>
    </section>
  );
}
