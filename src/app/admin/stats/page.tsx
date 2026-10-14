import type { Metadata } from "next";
import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { monthLabel, parsePeriod, pastMonths, periodRange, WHO_FROM, type Period } from "@/lib/stats/usage";
import { readStats, whoAre } from "@/lib/stats/usage-read";
import { walletSummary } from "@/lib/wallet/store";
import { monthStart } from "@/lib/ai/ledger";
import { loadSpend } from "../ai/actions";
import { SpendView } from "../ai/SpendView";
import { Card, PageHead, Stat } from "../ui";
import { StatsView } from "./StatsView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "การใช้งานและค่า AI | AdvisorTool" };

const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/**
 * สถิติการใช้งาน (owner, 2026-10-14; mockup https://claude.ai/artifact/59yop6T2WvJ4bH5ZRRkane):
 * which tools people use most, how many people, and what the AI behind each cost. The owner's
 * alone: it names every agent and what they spent.
 *
 * การใช้งานและค่า AI since 2026-10-15 (owner chose ข): every figure of spend in one place, under
 * three tabs — by tool (this page as it was), by person (with each wallet's balance), and by AI
 * company (from ตั้งค่า AI, with its jobs and who asked).
 */
const TABS = [
  { key: "tool", label: "ตามเครื่องมือ" },
  { key: "person", label: "ตามคน" },
  { key: "provider", label: "ตามค่าย AI" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const isTab = (v: unknown): v is Tab => v === "tool" || v === "person" || v === "provider";
export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/stats", "backoffice");
  const now = new Date();
  const params = await searchParams;
  const period = parsePeriod(params.p, now);
  const tab: Tab = isTab(params.tab) ? params.tab : "tool";
  /** a link to this page that keeps what else was chosen */
  const here = (next: { p?: Period; tab?: Tab }) => {
    const q = new URLSearchParams();
    const p = next.p ?? period;
    const t = next.tab ?? tab;
    if (p !== "month") q.set("p", p);
    if (t !== "tool") q.set("tab", t);
    return q.size ? `/admin/stats?${q}` : "/admin/stats";
  };
  const [from, to] = periodRange(period, now);

  let stats: Awaited<ReturnType<typeof readStats>> | null = null;
  try {
    stats = await readStats(from, to, now);
  } catch (e) {
    console.error("admin stats: not read:", e);
  }
  const [who, wallets, spend] = await Promise.all([
    stats ? whoAre(stats.people.map((p) => p.agentId)).catch(() => new Map()) : new Map(),
    // each person's balance now, beside what they used (the wallet page's figure)
    tab === "person" ? walletSummary(monthStart()).catch(() => null) : null,
    tab === "provider" ? loadSpend() : null,
  ]);
  const balance = new Map((wallets ?? []).map((w) => [w.agentId, w.balanceSatang]));
  const people = (stats?.people ?? []).map((p) => {
    const w = who.get(p.agentId);
    return {
      ...p, name: w?.name ?? "ไม่ทราบชื่อ", room: w?.member ? null : [w?.room, w?.unit].filter(Boolean).join(" · ") || null, member: w?.member ?? false,
      balanceSatang: balance.get(p.agentId) ?? null,
    };
  });

  const chips: { p: Period; label: string }[] = [
    { p: "7d", label: "7 วัน" }, { p: "30d", label: "30 วัน" }, { p: "month", label: "เดือนนี้" },
    ...pastMonths(now).map((m) => ({ p: m as Period, label: monthLabel(m) })),
  ];
  const top = stats?.tools[0];

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="การใช้งานและค่า AI" hint="ใครใช้เครื่องมืออะไร มากแค่ไหน และค่า AI ไปที่ไหน">
        {(
          <nav aria-label="ช่วงเวลา" className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Link
                key={c.p}
                href={here({ p: c.p })}
                aria-current={period === c.p ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-[13px] no-underline ${period === c.p
                  ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
                  : "border-[var(--bot-line)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]"}`}
              >
                {c.label}
              </Link>
            ))}
          </nav>
        )}
      </PageHead>

      {!stats ? (
        <p className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2.5 text-sm text-[var(--bot-red-ink)]">อ่านสถิติไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="คนที่ใช้งาน" value={`${stats.totals.people} คน`} sub="ใช้อย่างน้อย 1 เครื่องมือ" />
            <Stat label="ใช้เครื่องมือรวม" value={`${stats.totals.uses.toLocaleString("en-US")} ครั้ง`} sub={top && top.uses ? `มากสุด: ${top.name} ${top.uses} ครั้ง` : undefined} />
            <Stat
              label="ค่า AI รวม" value={baht(stats.totals.thbUser + stats.totals.thbSystem)}
              sub={`เครื่องมือของผู้ใช้ ${baht(stats.totals.thbUser)} · ระบบ/บอท ${baht(stats.totals.thbSystem)}`}
            />
            <Stat
              label="เงินเข้ากระเป๋า" value={baht(stats.totals.topupSatang / 100)}
              sub={`เติม ${stats.totals.topups} ครั้ง · หักใช้ไป ${baht(stats.totals.chargedSatang / 100)}`}
            />
          </div>
          <nav className="flex gap-0.5 overflow-x-auto border-b border-[var(--bot-line)]">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={here({ tab: t.key })}
                aria-current={t.key === tab ? "page" : undefined}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm no-underline ${t.key === tab
                  ? "border-[var(--bot-navy)] font-semibold text-[var(--bot-ink)]"
                  : "border-transparent text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink-foot)]"}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {tab === "provider" ? (
            <Card title="ค่า AI ตามค่าย" hint="เดือนนี้เสมอ ไม่ตามช่วงเวลาด้านบน: นับตั้งแต่ต้นเดือน หรือตั้งแต่กดรีเซ็ตยอดที่หน้าตั้งค่า AI · กด “ใช้ทำอะไร” ดูงานที่ใช้">
              {spend?.spend ? <SpendView spend={spend.spend} people={spend.people} /> : <p className="text-sm text-[var(--bot-red-ink)]">อ่านยอดใช้ AI ไม่สำเร็จ ลองโหลดหน้าใหม่อีกครั้ง</p>}
            </Card>
          ) : (
            <StatsView show={tab} tools={stats.tools} system={stats.system} daily={stats.daily} people={people} />
          )}
          {from < WHO_FROM && (
            <p className="text-xs text-[var(--bot-ink-mute)]">
              ก่อน 10 ต.ค. 2569 ระบบยังไม่จดว่าใครใช้ AI: ช่วงนั้นนับรอบ Studio ของตัวแทนจากบันทึกรอบ ส่วนรอบของเจ้าของและคำถามในหน้าถาม AI นับไม่ได้ (ค่า AI ยังรวมครบ)
            </p>
          )}
        </>
      )}
    </div>
  );
}
