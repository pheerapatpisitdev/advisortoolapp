import type { Metadata } from "next";
import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import {
  addDays, bkkDay, bkkTime, byDay, dayLabel, KIND_LABEL, matches, paidPerDay, parseKind, parseRange, rangeBounds, shortDay, summarize,
  type Chip, type MoneyKind, type MoneyRow, type Person, type Range,
} from "@/lib/wallet/money-in";
import { readMoneyIn, type MoneyIn } from "@/lib/wallet/money-in-read";
import { Card, Empty, PageHead } from "../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ประวัติเติมเงิน | AdvisorTool" };

/**
 * ประวัติเติมเงิน (owner, 2026-10-19, option ข; mockup https://claude.ai/artifact/NP3Zjuq9UjJ4BhUQwfFMHB):
 * who put money in, day by day, today first and back as far as the owner looks. See
 * src/lib/wallet/money-in.ts for what is counted.
 */

const BAR_DAYS = 30;
const CHIPS: { p: Chip; label: string }[] = [
  { p: "today", label: "วันนี้" }, { p: "7d", label: "7 วัน" }, { p: "30d", label: "30 วัน" }, { p: "90d", label: "90 วัน" },
];
const KINDS: (MoneyKind | null)[] = [null, "topup", "pass", "adjust", "refund"];

const baht = (satang: number) => `${satang < 0 ? "−" : ""}฿${(Math.abs(satang) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const KIND_TONE: Record<MoneyKind, string> = {
  topup: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
  pass: "bg-[var(--bot-navy-soft)] text-[var(--bot-navy)]",
  adjust: "bg-[var(--bot-band)] text-[var(--bot-ink-mute)]",
  refund: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]",
};

interface View { range: Range; kind: MoneyKind | null; q: string }

/** the address for a view; today, every kind and no search are left out */
function href(v: View): string {
  const s = new URLSearchParams();
  if (v.range.chip === null) s.set("d", v.range.fromDay);
  else if (v.range.chip !== "today") s.set("p", v.range.chip);
  if (v.kind) s.set("k", v.kind);
  if (v.q) s.set("q", v.q);
  const qs = s.toString();
  return qs ? `/admin/topups?${qs}` : "/admin/topups";
}

const pill = (on: boolean) => `rounded-full border px-3 py-1 text-[13px] no-underline ${on
  ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
  : "border-[var(--bot-line)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]"}`;

export default async function TopupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/topups", "backoffice");
  const sp = await searchParams;
  const now = new Date();
  const today = bkkDay(now);
  const range = parseRange(sp.p, sp.d, now);
  const kind = parseKind(sp.k);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const view: View = { range, kind, q };

  // one read covers the list and the bars' 30 days
  const barFrom = addDays(today, -(BAR_DAYS - 1));
  const [from] = rangeBounds({ ...range, fromDay: range.fromDay < barFrom ? range.fromDay : barFrom });
  const [, to] = rangeBounds({ fromDay: today, toDay: today, chip: "today" });
  let data: MoneyIn | null = null;
  try {
    data = await readMoneyIn(from, to);
  } catch (e) {
    console.error("topups: not read:", e);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="ประวัติเติมเงิน" hint="ใครเติมเงินเข้าระบบ วันไหน เวลาไหน เท่าไร · นับตามเวลาไทย" />

      <div className="flex flex-wrap items-center gap-1.5">
        <nav aria-label="ช่วงเวลา" className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <Link key={c.p} href={href({ ...view, range: parseRange(c.p, undefined, now) })} aria-current={range.chip === c.p ? "page" : undefined} className={pill(range.chip === c.p)}>
              {c.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/topups" className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {kind && <input type="hidden" name="k" value={kind} />}
          <label className="flex items-center gap-1.5 text-[13px] text-[var(--bot-ink-mute)]">
            วันที่
            <input type="date" name="d" defaultValue={range.chip === null ? range.fromDay : ""} max={today}
              className="min-h-9 rounded-md border border-[var(--bot-line)] bg-[var(--bot-surface)] px-2 text-[13px] text-[var(--bot-ink)]" />
          </label>
          <input type="search" name="q" defaultValue={q} placeholder="ค้นชื่อหรือรหัส" aria-label="ค้นชื่อหรือรหัส"
            className="min-h-9 w-40 rounded-md border border-[var(--bot-line)] bg-[var(--bot-surface)] px-2 text-[13px] text-[var(--bot-ink)]" />
          {range.chip !== null && <input type="hidden" name="p" value={range.chip} />}
          <button type="submit" className="min-h-9 rounded-md border border-[var(--bot-navy)] bg-[var(--bot-navy)] px-3 text-[13px] font-semibold text-white">ดู</button>
        </form>
      </div>

      <nav aria-label="ประเภท" className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <Link key={k ?? "all"} href={href({ ...view, kind: k })} aria-current={kind === k ? "page" : undefined} className={pill(kind === k)}>
            {k ? KIND_LABEL[k] : "ทั้งหมด"}
          </Link>
        ))}
      </nav>

      {!data ? (
        <p className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2.5 text-sm text-[var(--bot-red-ink)]">อ่านรายการเติมเงินไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
      ) : (
        <MoneyView data={data} view={view} now={now} today={today} barFrom={barFrom} />
      )}
    </div>
  );
}

const box = "rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4 min-w-0";
const th = "bg-[var(--bot-navy)] px-2.5 py-2 text-left font-semibold whitespace-nowrap text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-2 align-top";

function MoneyView({ data, view, now, today, barFrom }: { data: MoneyIn; view: View; now: Date; today: string; barFrom: string }) {
  const { range, kind, q } = view;
  const shown = data.rows.filter((r) => {
    const d = bkkDay(r.at);
    return d >= range.fromDay && d <= range.toDay && (!kind || r.kind === kind) && matches(data.people.get(r.who), q);
  });
  const sum = summarize(shown, data.first, kind);
  const oneDay = range.fromDay === range.toDay;
  const refunds = shown.some((r) => r.kind === "refund");

  const barDays = Array.from({ length: BAR_DAYS }, (_, i) => addDays(barFrom, i));
  const perDay = paidPerDay(data.rows, barDays);
  const top = Math.max(...perDay, 1);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={box}>
          <div className="text-xs text-[var(--bot-ink-mute)]">{kind === "adjust" ? "ยอดที่เจ้าของปรับ" : "ยอดเติมรวม"}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${sum.satang < 0 ? "text-[var(--bot-red-ink)]" : "text-[var(--bot-ok)]"}`}>{baht(sum.satang)}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">
            {kind === "adjust" ? "ไม่ใช่เงินที่ลูกค้าโอนเข้า" : refunds ? "หักเงินที่คืนแล้ว · ไม่นับเจ้าของปรับยอด" : "ไม่นับเจ้าของปรับยอด"}
          </div>
        </div>
        <div className={box}>
          <div className="text-xs text-[var(--bot-ink-mute)]">จำนวนครั้ง</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{sum.count.toLocaleString("en-US")}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">
            {sum.count ? `เติมกระเป๋าและค่าสมาชิก · เฉลี่ย ${baht(Math.round(shown.filter((r) => r.kind === "topup" || r.kind === "pass").reduce((n, r) => n + r.satang, 0) / sum.count))} ต่อครั้ง` : "ยังไม่มีใครเติม"}
          </div>
        </div>
        <div className={box}>
          <div className="text-xs text-[var(--bot-ink-mute)]">จำนวนคน</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{sum.people.toLocaleString("en-US")}</div>
          <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">{sum.firstTimers ? `เติมครั้งแรก ${sum.firstTimers} คน` : sum.people ? "ทุกคนเคยเติมมาก่อน" : "–"}</div>
        </div>
      </div>

      <Card title={`ความเคลื่อนไหวรายวัน · ${BAR_DAYS} วันล่าสุด`} hint="ความสูง = เงินที่เติมเข้าวันนั้น (เติมกระเป๋า + ค่าสมาชิก) · กดแท่งเพื่อดูรายชื่อวันนั้น">
        <div className="flex h-24 items-end gap-[3px] border-b border-[var(--bot-line)]">
          {barDays.map((d, i) => {
            const on = oneDay && d === range.fromDay;
            const label = `${dayLabel(d, now)} · ${baht(perDay[i])}`;
            return (
              <Link key={d} href={href({ ...view, range: { fromDay: d, toDay: d, chip: null } })} title={label} aria-label={label}
                aria-current={on ? "page" : undefined}
                className={`min-w-0 flex-1 rounded-t-[3px] ${perDay[i] ? "bg-[var(--bot-navy)]" : "bg-[var(--bot-line)] opacity-50"} ${on ? "outline outline-2 outline-offset-1 outline-[var(--bot-ok)]" : ""}`}
                style={{ height: perDay[i] ? `${Math.max(6, (perDay[i] / top) * 100)}%` : "2px" }} />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-[var(--bot-ink-faint)]">
          <span>{shortDay(barFrom)}</span><span>{shortDay(barDays[Math.floor(BAR_DAYS / 2)])}</span><span>{shortDay(today)}</span>
        </div>
      </Card>

      <Card
        title={oneDay ? `รายการ · ${dayLabel(range.fromDay, now)}` : `รายการ · ${shortDay(range.fromDay)} ถึง ${shortDay(range.toDay)}`}
        hint="ใหม่สุดอยู่บน · นับเฉพาะที่จ่ายสำเร็จแล้ว"
      >
        {shown.length === 0 ? (
          <Empty>{q ? "ไม่พบชื่อหรือรหัสนี้ในช่วงที่เลือก" : "ยังไม่มีรายการในช่วงนี้"}</Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {byDay(shown).map((g) => <Day key={g.day} day={g.day} rows={g.rows} people={data.people} first={data.first} now={now} />)}
          </div>
        )}
      </Card>
      <p className="text-xs text-[var(--bot-ink-faint)]">ช่องทางจ่าย (บัตร / PromptPay) ระบบยังไม่ได้เก็บไว้ จึงยังไม่แสดง</p>
    </>
  );
}

function Day({ day, rows, people, first, now }: { day: string; rows: MoneyRow[]; people: Map<string, Person>; first: Set<string>; now: Date }) {
  const paid = rows.filter((r) => r.kind === "topup" || r.kind === "pass").length;
  const sum = rows.filter((r) => r.kind !== "adjust").reduce((n, r) => n + r.satang, 0);
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-[13px]">
        <span className="font-semibold">{dayLabel(day, now)}</span>
        <span className="tabular-nums text-[var(--bot-ink-mute)]">{paid} ครั้ง · <strong className="font-semibold text-[var(--bot-ok)]">{baht(sum)}</strong></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={`${th} rounded-tl-md`}>เวลา</th>
              <th className={th}>ชื่อ</th>
              <th className={th}>สังกัด / หน่วย</th>
              <th className={th}>ประเภท</th>
              <th className={`${th} text-right`}>จำนวน</th>
              <th className={`${th} rounded-tr-md text-right`}>คงเหลือหลังรายการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = people.get(r.who);
              return (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap font-mono text-xs text-[var(--bot-ink-mute)]`}>{bkkTime(r.at)}</td>
                  <td className={td}>
                    {p?.name || "(ไม่มีชื่อ)"} <span className="text-xs text-[var(--bot-ink-faint)]">{p?.code}</span>
                    {first.has(r.id) && <span className="ml-1.5 rounded-full bg-[var(--bot-ok-soft)] px-2 text-[11px] text-[var(--bot-ok)]">ครั้งแรก</span>}
                  </td>
                  <td className={td}>
                    {p?.isMember
                      ? <span className="rounded-full bg-[var(--bot-navy-soft)] px-2 text-[11px] text-[var(--bot-navy)]">สมาชิกทั่วไป</span>
                      : [p?.tenant, p?.unit].filter(Boolean).join(" · ") || "–"}
                  </td>
                  <td className={td}><span className={`whitespace-nowrap rounded-full px-2 text-[11px] ${KIND_TONE[r.kind]}`}>{KIND_LABEL[r.kind]}</span></td>
                  <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${r.satang < 0 ? "text-[var(--bot-red-ink)]" : "text-[var(--bot-ok)]"}`}>
                    {r.satang > 0 ? "+" : ""}{baht(r.satang)}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{r.afterSatang == null ? "–" : baht(r.afterSatang)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
