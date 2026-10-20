import { PASS_KEY, type Profit } from "@/lib/stats/ai-profit";
import { Empty } from "../ui";

const baht = (n: number) => `฿${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n < 0 ? `−${baht(n)}` : baht(n));
const tone = (n: number) => (n < 0 ? "text-[var(--bot-red-ink)]" : n > 0 ? "text-[var(--bot-ok)]" : "");

const th = "bg-[var(--bot-navy)] px-2.5 py-2 text-left font-semibold whitespace-nowrap text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-2 align-middle";
const r = "text-right tabular-nums";
/** a share of the whole, "16%"; a share too small to round up says so rather than "0%" */
const pct = (part: number, whole: number) => {
  if (whole <= 0 || part <= 0) return "0%";
  const n = Math.round((part / whole) * 100);
  return n === 0 ? "<1%" : `${n}%`;
};

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
  // where the cost went, biggest first, paid work green and the rest red (owner chose ก, 2026-10-20,
  // mockup https://claude.ai/artifact/Rrn5QbY6qEGGorkJosgyDH)
  const parts = [
    { name: "งานที่เก็บเงินแล้ว", why: "ผู้ใช้จ่ายจากกระเป๋าเงิน", thb: s.paidThb, paid: true },
    { name: "รอบฟรีของผู้ใช้", why: "ตัวแทนและสมาชิกใช้สิทธิ์ฟรีหรือเครดิตทดลอง", thb: s.freeRoundsThb, paid: false },
    { name: "งานของเจ้าของ", why: "คุณและ Super Admin ใช้ฟรี", thb: s.ownerThb, paid: false },
    { name: "ถาม AI", why: "ฟรีทุกคน", thb: s.askThb, paid: false },
    { name: "บอทและระบบ", why: "บอทตอบแชทลูกค้า และงานเบื้องหลังของระบบ", thb: s.systemThb, paid: false },
  ].sort((a, b) => b.thb - a.thb);
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
        <div className="mt-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold">ต้นทุน {baht(whole)} ไปอยู่ที่ไหน</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-md bg-[var(--bot-ok-soft)] px-3 py-2.5 text-[var(--bot-ok)]">
              <span className="block text-[13px]">เก็บเงินได้</span>
              <span className="text-xl font-semibold tabular-nums">{baht(s.paidThb)} · {pct(s.paidThb, whole)}</span>
            </div>
            <div className="rounded-md bg-[var(--bot-red-soft)] px-3 py-2.5 text-[var(--bot-red-ink)]">
              <span className="block text-[13px]">ไม่ได้เก็บเงิน</span>
              <span className="text-xl font-semibold tabular-nums">{baht(whole - s.paidThb)} · {pct(whole - s.paidThb, whole)}</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2.5" aria-label="ต้นทุนแบ่งตามประเภทงาน">
            {parts.map((x) => (
              <li key={x.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{x.name}</span>
                <span className="whitespace-nowrap text-sm tabular-nums">{baht(x.thb)}<span className="ml-1.5 text-[13px] text-[var(--bot-ink-mute)]">{pct(x.thb, whole)}</span></span>
                <span className="col-span-2 h-2 overflow-hidden rounded bg-[var(--bot-band)]">
                  <span className="block h-full rounded" style={{ width: `${(x.thb / whole) * 100}%`, background: x.paid ? "var(--bot-ok)" : "var(--bot-red)" }} />
                </span>
                <span className="col-span-2 text-xs text-[var(--bot-ink-mute)]">{x.why}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--bot-ink-mute)]">เรียงจากมากไปน้อย · เขียว = เก็บเงินได้ · แดง = ไม่ได้เก็บเงิน</p>
        </div>
      )}
    </section>
  );
}
