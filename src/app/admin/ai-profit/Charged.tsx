import { PASS_KEY, type Profit } from "@/lib/stats/ai-profit";
import { Empty } from "../ui";

const baht = (n: number) => `฿${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n < 0 ? `−${baht(n)}` : baht(n));
const tone = (n: number) => (n < 0 ? "text-[var(--bot-red-ink)]" : n > 0 ? "text-[var(--bot-ok)]" : "");

const th = "bg-[var(--bot-navy)] px-2.5 py-2 text-left font-semibold whitespace-nowrap text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-2 align-middle";
const r = "text-right tabular-nums";

/**
 * What was taken from people's wallets for work delivered, by job, against that work's own AI
 * cost; and where the whole cost went (owner chose ก ก, 2026-10-20, mockup
 * https://claude.ai/artifact/RvhfJf8V1wpFRTeMvSoBbV). A charge is made only when a round is
 * delivered, so failed work is never in it. The members' pass is money in, not a charge: left out.
 */
export function Charged({ p }: { p: Profit }) {
  const jobs = p.revenue.items.filter((x) => x.key !== PASS_KEY);
  const sum = (f: (x: (typeof jobs)[number]) => number) => jobs.reduce((n, x) => n + f(x), 0);
  const charged = sum((x) => x.thb);
  const cost = sum((x) => x.costThb ?? 0);
  const count = sum((x) => x.count);
  const s = p.cost.split;
  const parts = [
    { name: "งานที่เก็บเงินแล้ว", thb: s.paidThb, color: "var(--bot-ok)" },
    { name: "รอบฟรีของผู้ใช้", thb: s.freeRoundsThb, color: "var(--bot-sand)" },
    { name: "งานของเจ้าของ", thb: s.ownerThb, color: "var(--bot-blue)" },
    { name: "ถาม AI (ฟรีทุกคน)", thb: s.askThb, color: "var(--bot-olive)" },
    { name: "บอทและระบบ", thb: s.systemThb, color: "var(--bot-grey)" },
  ];
  const whole = parts.reduce((n, x) => n + x.thb, 0);
  return (
    <section aria-label="เงินที่ตัดจากกระเป๋าผู้ใช้" className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">เงินที่ตัดจากกระเป๋าผู้ใช้</h2>
        <span className="whitespace-nowrap text-xl font-semibold tabular-nums sm:text-2xl">{baht(charged)}</span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">หักเมื่อส่งงานให้ผู้ใช้แล้วเท่านั้น งานที่ไม่สำเร็จไม่ถูกตัด · ต้นทุน AI คือค่าของงานชิ้นนั้นจริง</p>
      {jobs.length === 0 ? <div className="mt-3"><Empty>ช่วงนี้ยังไม่มีการตัดเงินจากกระเป๋า</Empty></div> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${th} rounded-tl-md`}>งาน</th>
                <th className={`${th} text-right`}>ครั้ง</th>
                <th className={`${th} text-right`}>ตัดจากผู้ใช้</th>
                <th className={`${th} text-right`}>ต้นทุน AI</th>
                <th className={`${th} rounded-tr-md text-right`}>กำไร</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((x) => (
                <tr key={x.key}>
                  <td className={td}>{x.name}</td>
                  <td className={`${td} ${r}`}>{x.count.toLocaleString("en-US")}</td>
                  <td className={`${td} ${r}`}>{baht(x.thb)}</td>
                  <td className={`${td} ${r}`}>{baht(x.costThb ?? 0)}</td>
                  <td className={`${td} ${r} ${tone(x.thb - (x.costThb ?? 0))}`}>{signed(x.thb - (x.costThb ?? 0))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-2.5 py-2">รวม</td>
                <td className={`px-2.5 py-2 ${r}`}>{count.toLocaleString("en-US")}</td>
                <td className={`px-2.5 py-2 ${r}`}>{baht(charged)}</td>
                <td className={`px-2.5 py-2 ${r}`}>{baht(cost)}</td>
                <td className={`px-2.5 py-2 ${r} ${tone(charged - cost)}`}>{signed(charged - cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {whole > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold">ต้นทุน {baht(p.cost.thb)} ไปอยู่ที่ไหน</h3>
          <div className="flex h-3 overflow-hidden rounded-full bg-[var(--bot-line)]" role="img" aria-label="ต้นทุนแบ่งตามประเภทงาน">
            {parts.map((x) => x.thb > 0 && <span key={x.name} style={{ width: `${(x.thb / whole) * 100}%`, background: x.color }} />)}
          </div>
          <div className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {parts.map((x) => (
              <div key={x.name} className="flex justify-between gap-2">
                <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: x.color }} />{x.name}</span>
                <span className="tabular-nums">{baht(x.thb)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
