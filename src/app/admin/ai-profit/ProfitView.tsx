import Link from "next/link";
import type { Profit } from "@/lib/stats/ai-profit";
import { Card } from "../ui";
import { Charged } from "./Charged";

/**
 * กำไรค่า AI (owner, 2026-10-15; mockup https://claude.ai/artifact/AtZX1kdb8bWBLLtBSEGUZc):
 * what the AI cost, what people paid for it, and the difference. The owner chose ก: the cost is
 * the system's own estimate, with no box for the companies' real bills. See src/lib/stats/ai-profit.ts.
 *
 * The short sum (owner chose ก, 2026-10-19; mockup https://claude.ai/artifact/S7GWwG8xZjnEf7JFev6UaV):
 * the money customers put in, less what the AI cost, is the profit. Under it, where the money
 * came from. Since 2026-10-23 (owner chose ก, mockup https://claude.ai/artifact/1MZqF78ZXVU64Pv5wPzh2u)
 * this is the first tab of การใช้งานและค่า AI, and the card "ต้นทุนจ่ายให้ใคร" is gone: the same
 * figures are on the tab ตามค่าย AI beside it, so there is one place to read them.
 */

const baht = (n: number) => `฿${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n < 0 ? `−${baht(n)}` : baht(n));
const tone = (n: number) => (n < 0 ? "text-[var(--bot-red-ink)]" : n > 0 ? "text-[var(--bot-ok)]" : "");

const th = "bg-[var(--bot-navy)] px-2.5 py-2 text-left font-semibold whitespace-nowrap text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-2 align-middle";
const r = "text-right tabular-nums";

export function ProfitView({ p, costHref }: { p: Profit; /** where the cost by AI company is read */ costHref: string }) {
  const loss = p.cashThb < 0;
  const line = "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-baseline gap-2.5 py-3.5";
  const op = "text-center text-xl font-semibold text-[var(--bot-ink-mute)]";
  const fig = "whitespace-nowrap text-xl font-semibold tabular-nums sm:text-2xl";
  return (
    <>
      <section aria-label="สรุปกำไร" className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] px-4">
        <div className={`${line} border-b border-[var(--bot-line)]`}>
          <span className={op} />
          <span className="min-w-0 text-[15px] font-semibold">
            เงินที่ลูกค้าเติมเข้าระบบ
            <span className="block text-xs font-normal text-[var(--bot-ink-mute)]">
              เติมกระเป๋า {p.moneyIn.topups.count.toLocaleString("en-US")} ครั้ง + ค่าสมาชิก {p.moneyIn.passes.count.toLocaleString("en-US")} ครั้ง · หักเงินที่คืนแล้ว
            </span>
          </span>
          <span className={`${fig} ${tone(p.moneyIn.thb)}`}>{signed(p.moneyIn.thb)}</span>
        </div>
        <div className={line}>
          <span className={op}>−</span>
          <span className="min-w-0 text-[15px] font-semibold">
            ต้นทุนค่า AI ที่จ่ายให้บริษัท AI
            <span className="block text-xs font-normal text-[var(--bot-ink-mute)]">
              ทุกงานในระบบ รวมงานฟรี บอท และงานของเจ้าของ · <Link href={costHref} className="text-[var(--bot-navy)] underline">ดูแยกตามบริษัท (ทั้งเดือน)</Link>
            </span>
          </span>
          <span className={fig}>{baht(p.cost.thb)}</span>
        </div>
        <div className={`${line} -mx-4 rounded-b-lg border-t-2 border-[var(--bot-ink)] px-4 ${loss ? "bg-[var(--bot-red-soft)]" : "bg-[var(--bot-ok-soft)]"}`}>
          <span className={op}>=</span>
          <span className="text-[15px] font-semibold">{loss ? "ขาดทุน" : "กำไร"}</span>
          <span className={`whitespace-nowrap text-2xl font-semibold tabular-nums sm:text-3xl ${loss ? "text-[var(--bot-red-ink)]" : "text-[var(--bot-ok)]"}`}>{baht(p.cashThb)}</span>
        </div>
      </section>
      {p.unspentThb != null && (
        <p className="text-[13px] text-[var(--bot-ink-mute)]">
          เงินในกระเป๋าที่ลูกค้ายังไม่ได้ใช้ตอนนี้ <b className="tabular-nums text-[var(--bot-ink)]">{baht(p.unspentThb)}</b> · ยังต้องให้บริการเป็นงาน AI อีกเท่านี้
        </p>
      )}

      <Charged p={p} />

      <Card title="เงินเข้ามาจากไหน">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className={`${th} rounded-tl-md`}>รายการ</th><th className={`${th} rounded-tr-md text-right`}>จำนวนเงิน</th></tr></thead>
          <tbody>
            {([
              ["เติมกระเป๋า (บัตร / PromptPay)", p.moneyIn.topups.thb],
              ["ค่าสมาชิกทั่วไป", p.moneyIn.passes.thb],
              ["คืนเงินให้ลูกค้า", p.moneyIn.refunds.thb],
            ] as const).map(([name, thb]) => (
              <tr key={name}><td className={td}>{name}</td><td className={`${td} ${r}`}>{signed(thb)}</td></tr>
            ))}
            <tr className="font-semibold"><td className="px-2.5 py-2">รวมเงินเข้า</td><td className={`px-2.5 py-2 ${r}`}>{signed(p.moneyIn.thb)}</td></tr>
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-[var(--bot-ink-faint)]">ต้นทุนเป็นตัวเลขที่ระบบคำนวณจากการใช้งานจริง × ราคาของแต่ละรุ่น (1 ดอลลาร์ = 36 บาท) อาจต่างจากบิลจริงเล็กน้อย</p>
    </>
  );
}
