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
    { p: "7d", label: "7 วัน" }, { p: "30d", label: "30 วัน" }, { p: "month", label: "เดือนนี้" },
    ...pastMonths(now).map((m) => ({ p: m as Period, label: monthLabel(m) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="กำไรค่า AI" hint="ค่า AI ที่จ่ายให้บริษัท AI เทียบกับที่เก็บจากผู้ใช้ และเงินที่ลูกค้าโอนเข้า">
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

const box = "rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4 min-w-0";

/** one line of the sum: what it is, the sum written out, and what came of it */
function Result({ what, eq, thb, word }: { what: string; eq: string; thb: number; word: [string, string] }) {
  const below = thb < 0;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${below
      ? "border-[var(--bot-red)] bg-[var(--bot-red-soft)]"
      : "border-[var(--bot-ok-line)] bg-[var(--bot-ok-soft)]"}`}>
      <div className="min-w-0">
        <div className="text-xs text-[var(--bot-ink-mute)]">{what}</div>
        <div className="text-sm tabular-nums">{eq}</div>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${below ? "text-[var(--bot-red-ink)]" : "text-[var(--bot-ok)]"}`}>
        {thb === 0 ? "เท่าทุน" : `${below ? word[1] : word[0]} ${baht(thb)}`}
      </div>
    </div>
  );
}

function ProfitView({ p }: { p: Profit }) {
  const s = p.cost.split;
  const paidProfit = p.revenue.thb - s.paidThb;
  const unpaid = s.freeRoundsThb + s.ownerThb + s.askThb + s.systemThb;
  /** rounds paid from a wallet; a pass is counted on its own */
  const charged = p.revenue.items.filter((x) => x.costThb != null).reduce((n, x) => n + x.count, 0);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <div className={box}>
          <div className="text-xs text-[var(--bot-ink-mute)]">① ค่า AI ที่จ่ายให้บริษัท AI (ต้นทุน)</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{baht(p.cost.thb)}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">ระบบคำนวณจากจำนวนที่ใช้ × ราคาของแต่ละรุ่น (1 ดอลลาร์ = 36 บาท)</div>
        </div>
        <div className={box}>
          <div className="text-xs text-[var(--bot-ink-mute)]">② ค่า AI ที่เก็บจากผู้ใช้ (ราคาที่เราตั้ง)</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{baht(p.revenue.thb)}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">หักจากกระเป๋าเงินเมื่อใช้งาน + ค่าสมาชิกที่ขายได้</div>
        </div>
        <div className={box}>
          <div className="text-xs text-[var(--bot-ink-mute)]">③ เงินที่ลูกค้าโอนเข้าบัญชี</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{signed(p.moneyIn.thb)}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">
            เติมกระเป๋า {p.moneyIn.topups.count.toLocaleString("en-US")} ครั้ง + ค่าสมาชิก {p.moneyIn.passes.count.toLocaleString("en-US")} ครั้ง · หักเงินที่คืนลูกค้าแล้ว
          </div>
        </div>
      </div>

      <Result what="กำไรจากการใช้งาน" eq={`② ${baht(p.revenue.thb)} − ① ${baht(p.cost.thb)} =`} thb={p.profitThb} word={["กำไร", "ขาดทุน"]} />
      <Result what="เงินสดเข้า หักค่า AI" eq={`③ ${signed(p.moneyIn.thb)} − ① ${baht(p.cost.thb)} =`} thb={p.cashThb} word={["เหลือ", "ขาด"]} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--bot-ok-line)] bg-[var(--bot-ok-soft)] px-4 py-3">
          <div className="text-xs text-[var(--bot-ink-mute)]">งานที่มีคนจ่าย</div>
          <div className={`text-2xl font-semibold tabular-nums ${tone(paidProfit)}`}>{paidProfit < 0 ? `ขาดทุน ${baht(paidProfit)}` : `กำไร ${baht(paidProfit)}`}</div>
          {s.paidThb > 0 && <div className="text-xs text-[var(--bot-ink-mute)]">เก็บได้ {(p.revenue.thb / s.paidThb).toFixed(1)} เท่าของต้นทุน</div>}
        </div>
        <div className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-4 py-3">
          <div className="text-xs text-[var(--bot-ink-mute)]">งานที่ไม่มีใครจ่าย</div>
          <div className="text-2xl font-semibold tabular-nums text-[var(--bot-red-ink)]">ต้นทุน {baht(unpaid)}</div>
          <div className="text-xs text-[var(--bot-ink-mute)]">รอบฟรี, เจ้าของ, ถาม AI, บอท</div>
        </div>
      </div>

      <Card title="แยกว่ากำไรหรือขาดทุนตรงไหน">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={th}>ส่วนงาน</th><th className={`${th} text-right`}>① ต้นทุน</th><th className={`${th} text-right`}>② เก็บได้</th><th className={`${th} text-right`}>กำไร / ขาดทุน</th></tr></thead>
            <tbody>
              <tr>
                <td className={td}>
                  <b>งานที่มีคนจ่าย</b>
                  <span className="block text-xs text-[var(--bot-ink-mute)]">หักจากกระเป๋าเงิน {charged.toLocaleString("en-US")} ครั้ง{p.moneyIn.passes.count ? ` + ค่าสมาชิก ${p.moneyIn.passes.count} ครั้ง` : ""}</span>
                </td>
                <td className={`${td} ${r}`}>{baht(s.paidThb)}</td>
                <td className={`${td} ${r}`}>{baht(p.revenue.thb)}</td>
                <td className={`${td} ${r} ${tone(paidProfit)}`}>{signed(paidProfit)}</td>
              </tr>
              <tr><td colSpan={4} className="bg-[var(--bot-band)] px-2.5 py-1.5 text-xs font-semibold text-[var(--bot-ink-mute)]">งานที่ไม่มีใครจ่าย</td></tr>
              {([
                ["รอบฟรีของตัวแทนและสมาชิก", "รอบฟรีของตัวแทน และรอบกับคลิปที่มากับค่าสมาชิก", s.freeRoundsThb],
                ["งานของเจ้าของ", "บัญชีเจ้าของและ Super Admin ใช้ฟรี", s.ownerThb],
                ["ถาม AI", "ฟรีทุกคน", s.askThb],
                ["บอทตอบลูกค้าและงานของระบบ", "Messenger, LINE, เว็บ", s.systemThb],
              ] as const).map(([name, why, thb]) => (
                <tr key={name}>
                  <td className={`${td} pl-6`}>{name}<span className="block text-xs text-[var(--bot-ink-mute)]">{why}</span></td>
                  <td className={`${td} ${r}`}>{baht(thb)}</td>
                  <td className={`${td} ${r}`}>–</td>
                  <td className={`${td} ${r} ${tone(-thb)}`}>{signed(-thb)}</td>
                </tr>
              ))}
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

      <Card title="② เก็บจากผู้ใช้ แยกตามงาน" hint="ต้นทุนของแต่ละงานคือค่า AI ที่ระบบจดไว้ตอนหักเงินรอบนั้นจริง">
        {p.revenue.items.length === 0 ? <Empty>ช่วงนี้ยังไม่มีใครจ่ายค่า AI</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr>
                <th className={th}>งาน</th><th className={`${th} text-right`}>ครั้ง</th><th className={`${th} text-right`}>ต้นทุน</th>
                <th className={`${th} text-right`}>เก็บได้</th><th className={`${th} text-right`}>กำไร</th>
              </tr></thead>
              <tbody>
                {p.revenue.items.map((x) => {
                  const gain = x.thb - (x.costThb ?? 0);
                  return (
                    <tr key={x.key}>
                      <td className={td}>{x.name}</td>
                      <td className={`${td} ${r}`}>{x.count.toLocaleString("en-US")}</td>
                      <td className={`${td} ${r}`}>{x.costThb == null ? "–" : baht(x.costThb)}</td>
                      <td className={`${td} ${r}`}>{baht(x.thb)}</td>
                      <td className={`${td} ${r} ${tone(gain)}`}>{signed(gain)}</td>
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td className="px-2.5 py-2">รวม</td><td className={`px-2.5 py-2 ${r}`}>{charged.toLocaleString("en-US")}</td>
                  <td className={`px-2.5 py-2 ${r}`}>{baht(s.paidThb)}</td><td className={`px-2.5 py-2 ${r}`}>{baht(p.revenue.thb)}</td>
                  <td className={`px-2.5 py-2 ${r} ${tone(paidProfit)}`}>{signed(paidProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">ไม่นับเงินที่เติมเข้ากระเป๋าจนกว่าผู้ใช้จะใช้จริง · ค่าสมาชิกไม่มีต้นทุนในแถวนี้ รอบที่มากับค่าสมาชิกนับอยู่ในรอบฟรี</p>
      </Card>

      <Card title="③ เงินที่ลูกค้าโอนเข้า">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={th}>รายการ</th><th className={`${th} text-right`}>ครั้ง</th><th className={`${th} text-right`}>จำนวนเงิน</th></tr></thead>
            <tbody>
              {([
                ["เติมเงินเข้ากระเป๋า (บัตร / PromptPay)", p.moneyIn.topups],
                ["ค่าสมาชิกทั่วไป", p.moneyIn.passes],
                ["คืนเงิน / ลูกค้าขอเงินคืนจากธนาคาร", p.moneyIn.refunds],
              ] as const).map(([name, x]) => (
                <tr key={name}><td className={td}>{name}</td><td className={`${td} ${r}`}>{x.count.toLocaleString("en-US")}</td><td className={`${td} ${r}`}>{signed(x.thb)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="px-2.5 py-2">รวมเงินเข้าจริง</td><td className="px-2.5 py-2" /><td className={`px-2.5 py-2 ${r}`}>{signed(p.moneyIn.thb)}</td></tr>
            </tbody>
          </table>
        </div>
        {p.unspentThb != null && (
          <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">
            เงินในกระเป๋าที่ลูกค้ายังไม่ได้ใช้ตอนนี้ <b className="text-[var(--bot-ink)]">{baht(p.unspentThb)}</b> เป็นเงินที่ลูกค้ายังใช้แลกงาน AI ได้อีก
          </p>
        )}
      </Card>

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
    </>
  );
}
