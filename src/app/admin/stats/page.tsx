import type { Metadata } from "next";
import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { monthLabel, parsePeriod, pastMonths, periodRange, WHO_FROM, type Period } from "@/lib/stats/usage";
import { readStats, whoAre } from "@/lib/stats/usage-read";
import { Stat } from "../ui";
import { StatsView } from "./StatsView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สถิติการใช้งาน | AdvisorTool" };

const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/**
 * สถิติการใช้งาน (owner, 2026-10-14; mockup https://claude.ai/artifact/59yop6T2WvJ4bH5ZRRkane):
 * which tools people use most, how many people, and what the AI behind each cost. The owner's
 * alone: it names every agent and what they spent.
 */
export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/stats", "owner");
  const now = new Date();
  const period = parsePeriod((await searchParams).p, now);
  const [from, to] = periodRange(period, now);

  let stats: Awaited<ReturnType<typeof readStats>> | null = null;
  try {
    stats = await readStats(from, to, now);
  } catch (e) {
    console.error("admin stats: not read:", e);
  }
  const who = stats ? await whoAre(stats.people.map((p) => p.agentId)).catch(() => new Map()) : new Map();
  const people = (stats?.people ?? []).map((p) => {
    const w = who.get(p.agentId);
    return { ...p, name: w?.name ?? "ไม่ทราบชื่อ", room: w?.member ? null : [w?.room, w?.unit].filter(Boolean).join(" · ") || null, member: w?.member ?? false };
  });

  const chips: { p: Period; label: string }[] = [
    { p: "7d", label: "7 วัน" }, { p: "30d", label: "30 วัน" }, { p: "month", label: "เดือนนี้" },
    ...pastMonths(now).map((m) => ({ p: m as Period, label: monthLabel(m) })),
  ];
  const top = stats?.tools[0];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">สถิติการใช้งาน</h1>
          <p className="text-sm text-[var(--bot-ink-mute)]">ใครใช้เครื่องมืออะไร มากแค่ไหน และเสียค่า AI เท่าไหร่</p>
        </div>
        <nav aria-label="ช่วงเวลา" className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.p}
              href={c.p === "month" ? "/admin/stats" : `/admin/stats?p=${c.p}`}
              aria-current={period === c.p ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-[13px] no-underline ${period === c.p
                ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
                : "border-[var(--bot-line)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]"}`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </header>

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
          <StatsView tools={stats.tools} system={stats.system} daily={stats.daily} people={people} />
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
