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
 */

const baht = (n: number) => `฿${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n < 0 ? `−${baht(n)}` : baht(n));
const verdict = (n: number) => (n < 0 ? `ขาดทุน ${baht(n)}` : n > 0 ? `กำไร ${baht(n)}` : "เท่าทุน");
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
    { p: "7d", label: "7 วัน" }, { p: "30d", label: "30 วัน" }, { p: "month", label: "เดือนนี้" },
    ...pastMonths(now).map((m) => ({ p: m as Period, label: monthLabel(m) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="กำไรค่า AI" hint="ค่า AI ที่จ่ายให้บริษัท AI เทียบกับที่เก็บจากผู้ใช้ตามราคาที่เราตั้ง">
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

function ProfitView({ p }: { p: Profit }) {
  const loss = p.profitThb < 0;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
          <div className="text-xs text-[var(--bot-ink-mute)]">① ค่า AI ที่จ่ายให้บริษัท AI (ต้นทุน)</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{baht(p.cost.thb)}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">ระบบคำนวณจากจำนวนที่ใช้ × ราคาของแต่ละรุ่น (1 ดอลลาร์ = 36 บาท)</div>
        </div>
        <div className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
          <div className="text-xs text-[var(--bot-ink-mute)]">② ค่า AI ที่เก็บจากผู้ใช้ (ราคาที่เราตั้ง)</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{baht(p.revenue.thb)}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">หักจากกระเป๋าเงินเมื่อใช้งาน + ค่าสมาชิกที่ขายได้</div>
        </div>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${loss
        ? "border-[var(--bot-red)] bg-[var(--bot-red-soft)]"
        : "border-[var(--bot-ok-line)] bg-[var(--bot-ok-soft)]"}`}>
        <div className="text-sm tabular-nums">② {baht(p.revenue.thb)} − ① {baht(p.cost.thb)} =</div>
        <div className={`text-2xl font-semibold tabular-nums ${loss ? "text-[var(--bot-red-ink)]" : "text-[var(--bot-ink)]"}`}>{verdict(p.profitThb)}</div>
      </div>

      <Card title="แยกว่ากำไรหรือขาดทุนตรงไหน">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={th}>ส่วนงาน</th><th className={`${th} text-right`}>① ต้นทุน</th><th className={`${th} text-right`}>② เก็บได้</th><th className={`${th} text-right`}>กำไร / ขาดทุน</th></tr></thead>
            <tbody>
              <tr>
                <td className={td}>งานที่ผู้ใช้สั่ง (Studio, วิดีโอ, ถาม AI)</td>
                <td className={`${td} ${r}`}>{baht(p.cost.userThb)}</td>
                <td className={`${td} ${r}`}>{baht(p.revenue.thb)}</td>
                <td className={`${td} ${r} ${tone(p.userProfitThb)}`}>{signed(p.userProfitThb)}</td>
              </tr>
              <tr>
                <td className={td}>บอทตอบลูกค้าและงานของระบบ <span className="text-[var(--bot-ink-mute)]">ไม่มีใครจ่าย</span></td>
                <td className={`${td} ${r}`}>{baht(p.cost.systemThb)}</td>
                <td className={`${td} ${r}`}>–</td>
                <td className={`${td} ${r} ${tone(-p.cost.systemThb)}`}>{signed(-p.cost.systemThb)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-2.5 py-2">รวม</td>
                <td className={`px-2.5 py-2 ${r}`}>{baht(p.cost.thb)}</td>
                <td className={`px-2.5 py-2 ${r}`}>{baht(p.revenue.thb)}</td>
                <td className={`px-2.5 py-2 ${r} ${tone(p.profitThb)}`}>{signed(p.profitThb)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="① ต้นทุน แยกตามบริษัท AI">
          {p.cost.providers.length === 0 ? <Empty>ช่วงนี้ยังไม่มีค่า AI</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr><th className={th}>บริษัท</th><th className={`${th} text-right`}>ค่า AI</th></tr></thead>
                <tbody>
                  {p.cost.providers.map((x) => (
                    <tr key={x.provider}><td className={td}>{PROVIDER_LABEL[x.provider] ?? x.provider}</td><td className={`${td} ${r}`}>{baht(x.thb)}</td></tr>
                  ))}
                  <tr className="font-semibold"><td className="px-2.5 py-2">รวม</td><td className={`px-2.5 py-2 ${r}`}>{baht(p.cost.thb)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">ตัวเลขที่ระบบคำนวณ อาจต่างจากบิลจริงเล็กน้อย (อัตราแลกเปลี่ยน ส่วนลด หรือค่าแพ็กเกจรายเดือน)</p>
        </Card>

        <Card title="② เก็บจากผู้ใช้ แยกตามงาน">
          {p.revenue.items.length === 0 ? <Empty>ช่วงนี้ยังไม่มีใครจ่ายค่า AI</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr><th className={th}>งาน</th><th className={`${th} text-right`}>ครั้ง</th><th className={`${th} text-right`}>เก็บได้</th></tr></thead>
                <tbody>
                  {p.revenue.items.map((x) => (
                    <tr key={x.key}><td className={td}>{x.name}</td><td className={`${td} ${r}`}>{x.count.toLocaleString("en-US")}</td><td className={`${td} ${r}`}>{baht(x.thb)}</td></tr>
                  ))}
                  <tr className="font-semibold"><td className="px-2.5 py-2">รวม</td><td className="px-2.5 py-2" /><td className={`px-2.5 py-2 ${r}`}>{baht(p.revenue.thb)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">ไม่นับเงินที่เติมเข้ากระเป๋าจนกว่าผู้ใช้จะใช้จริง · รอบฟรีและงานของเจ้าของนับเป็นต้นทุน แต่ไม่มีรายได้</p>
        </Card>
      </div>
    </>
  );
}
