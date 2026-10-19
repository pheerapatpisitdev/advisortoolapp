import type { Metadata } from "next";
import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { monthLabel, parsePeriod, pastMonths, periodRange, type Period } from "@/lib/stats/usage";
import { readProfit } from "@/lib/stats/ai-profit-read";
import type { Profit } from "@/lib/stats/ai-profit";
import { PROVIDER_LABEL } from "../ai/labels";
import { Card, Empty, PageHead } from "../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กำไรค่า AI | AdvisorTool" };

/**
 * กำไรค่า AI (owner, 2026-10-15; mockup https://claude.ai/artifact/AtZX1kdb8bWBLLtBSEGUZc):
 * what the AI cost, what people paid for it, and the difference. The owner chose ก: the cost is
 * the system's own estimate, with no box for the companies' real bills. See src/lib/stats/ai-profit.ts.
 * The money customers transferred in, and that money less the cost, since 2026-10-15 (owner chose ก).
 * Since 2026-10-19 that sum is the whole page (owner chose ก): see ProfitView below.
 */

const baht = (n: number) => `฿${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n < 0 ? `−${baht(n)}` : baht(n));
const tone = (n: number) => (n < 0 ? "text-[var(--bot-red-ink)]" : n > 0 ? "text-[var(--bot-ok)]" : "");

const th = "bg-[var(--bot-navy)] px-2.5 py-2 text-left font-semibold whitespace-nowrap text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-2 align-middle";
const r = "text-right tabular-nums";

export default async function AiProfitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/ai-profit", "backoffice");
  const now = new Date();
  const period = parsePeriod((await searchParams).p, now);
  const [from, to] = periodRange(period, now);

  let profit: Profit | null = null;
  try {
    profit = await readProfit(from, to);
  } catch (e) {
    console.error("ai profit: not read:", e);
  }

  const chips: { p: Period; label: string }[] = [
    { p: "today", label: "วันนี้" }, { p: "7d", label: "7 วัน" }, { p: "30d", label: "30 วัน" }, { p: "month", label: "เดือนนี้" },
    ...pastMonths(now).map((m) => ({ p: m as Period, label: monthLabel(m) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="กำไรค่า AI" hint="เงินที่ลูกค้าเติมเข้าระบบ หักค่า AI ที่จ่ายให้บริษัท AI">
        <nav aria-label="ช่วงเวลา" className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.p}
              href={c.p === "month" ? "/admin/ai-profit" : `/admin/ai-profit?p=${c.p}`}
              aria-current={period === c.p ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-[13px] no-underline ${period === c.p
                ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
                : "border-[var(--bot-line)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]"}`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </PageHead>

      {!profit ? (
        <p className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2.5 text-sm text-[var(--bot-red-ink)]">อ่านตัวเลขไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
      ) : (
        <ProfitView p={profit} />
      )}
    </div>
  );
}

/**
 * The short sum (owner chose ก, 2026-10-19; mockup https://claude.ai/artifact/S7GWwG8xZjnEf7JFev6UaV):
 * the money customers put in, less what the AI cost, is the profit. Under it, where the money
 * came from and whom the cost was paid to. The tables by kind of work and paid / unpaid went;
 * the use by tool is on การใช้งานและค่า AI (/admin/stats).
 */
function ProfitView({ p }: { p: Profit }) {
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
            <span className="block text-xs font-normal text-[var(--bot-ink-mute)]">ทุกงานในระบบ รวมงานฟรี บอท และงานของเจ้าของ</span>
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

      <div className="grid gap-3 md:grid-cols-2">
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
        <Card title="ต้นทุนจ่ายให้ใคร">
          {p.cost.providers.length === 0 ? <Empty>ช่วงนี้ยังไม่มีค่า AI</Empty> : (
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className={`${th} rounded-tl-md`}>บริษัท</th><th className={`${th} rounded-tr-md text-right`}>ค่า AI</th></tr></thead>
              <tbody>
                {p.cost.providers.map((x) => (
                  <tr key={x.provider}><td className={td}>{PROVIDER_LABEL[x.provider] ?? x.provider}</td><td className={`${td} ${r}`}>{baht(x.thb)}</td></tr>
                ))}
                <tr className="font-semibold"><td className="px-2.5 py-2">รวมต้นทุน</td><td className={`px-2.5 py-2 ${r}`}>{baht(p.cost.thb)}</td></tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <p className="text-xs text-[var(--bot-ink-faint)]">ต้นทุนเป็นตัวเลขที่ระบบคำนวณจากการใช้งานจริง × ราคาของแต่ละรุ่น (1 ดอลลาร์ = 36 บาท) อาจต่างจากบิลจริงเล็กน้อย</p>
    </>
  );
}
