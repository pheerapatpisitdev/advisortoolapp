"use client";

import { Fragment, useState } from "react";
import type { PersonRow, SystemRow, ToolRow } from "@/lib/stats/usage";

/**
 * The tables and the two charts of /admin/stats, as the mockup has them: tools ranked by uses
 * or by cost, a tool's parts opened under it, uses per day, AI cost per tool, and the people
 * (five first, the rest a click away).
 */

type Person = PersonRow & { name: string; room: string | null; member: boolean };

const PEOPLE_SHOWN = 5;
const COST_SHOWN = 6;

const baht = (n: number) => (n ? `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–");
const num = (n: number) => n.toLocaleString("en-US");
const dayNum = (ymd: string) => Number(ymd.slice(8));
const dayLong = (ymd: string) =>
  new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

const card = "rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4 min-w-0";
const th = "bg-[var(--bot-navy)] px-2.5 py-2 text-left font-semibold whitespace-nowrap text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-2 align-middle";

function Bar({ value, max, soft }: { value: number; max: number; soft?: boolean }) {
  return (
    <div
      className="h-2.5 rounded-r"
      style={{ width: `${max ? Math.max((value / max) * 100, value ? 1.5 : 0) : 0}%`, background: soft ? "var(--bot-blue)" : "var(--bot-navy)" }}
    />
  );
}

export function StatsView({ tools, system, daily, people }: { tools: ToolRow[]; system: SystemRow[]; daily: { day: string; uses: number }[]; people: Person[] }) {
  const [sort, setSort] = useState<"uses" | "thb">("uses");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [everyone, setEveryone] = useState(false);
  const rows = [...tools].sort((a, b) => (sort === "uses" ? b.uses - a.uses || b.thb - a.thb : b.thb - a.thb || b.uses - a.uses));
  const maxUses = Math.max(1, ...tools.map((t) => t.uses));
  const userThb = tools.reduce((s, t) => s + t.thb, 0);
  const costly = tools.filter((t) => t.thb > 0).sort((a, b) => b.thb - a.thb).slice(0, COST_SHOWN);
  const toggle = (k: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const shownPeople = everyone ? people : people.slice(0, PEOPLE_SHOWN);

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">เครื่องมือที่ใช้มากที่สุด</h2>
          <div role="group" aria-label="เรียงตาม" className="flex gap-1.5">
            {([["uses", "เรียงตามจำนวนครั้ง"], ["thb", "เรียงตามค่าใช้จ่าย"]] as const).map(([k, label]) => (
              <button
                key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}
                className={`rounded-full border px-3 py-1 text-[13px] ${sort === k ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white" : "border-[var(--bot-line)] bg-[var(--bot-surface)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {tools.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--bot-ink-mute)]">ยังไม่มีการใช้งานในช่วงนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr>
                  <th className={`${th} min-w-40`}>เครื่องมือ</th>
                  <th className={`${th} w-[30%] min-w-36 max-sm:hidden`}>จำนวนครั้ง</th>
                  <th className={`${th} text-right`}>ครั้ง</th>
                  <th className={`${th} text-right`}>คนใช้</th>
                  <th className={`${th} text-right`}>ค่า AI</th>
                  <th className={`${th} text-right`}>เฉลี่ย/ครั้ง</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <Fragment key={t.key}>
                    <tr>
                      <td className={td}>
                        <span className="font-medium">{t.name}</span>
                        <small className="block text-xs text-[var(--bot-ink-mute)]">{t.sub}</small>
                        {t.parts.length > 1 && (
                          <button type="button" onClick={() => toggle(t.key)} aria-expanded={open.has(t.key)} className="text-xs font-semibold text-[var(--bot-navy)]">
                            {open.has(t.key) ? "ซ่อน ▴" : "แยกตามแบบ ▾"}
                          </button>
                        )}
                      </td>
                      <td className={`${td} max-sm:hidden`}><Bar value={t.uses} max={maxUses} /></td>
                      <td className={`${td} text-right`}>{num(t.uses)}</td>
                      <td className={`${td} text-right`}>{t.people || "–"}</td>
                      <td className={`${td} text-right`}>{baht(t.thb)}</td>
                      <td className={`${td} text-right`}>{t.thb && t.uses ? baht(t.thb / t.uses) : "–"}</td>
                    </tr>
                    {open.has(t.key) && t.parts.map((p) => (
                      <tr key={`${t.key}-${p.name}`} className="text-[13px] text-[var(--bot-ink-mute)]">
                        <td className={`${td} py-1 pl-6`}>{p.name}</td>
                        <td className={`${td} py-1 max-sm:hidden`}><Bar value={p.uses} max={maxUses} soft /></td>
                        <td className={`${td} py-1 text-right`}>{num(p.uses)}</td>
                        <td className={td} /><td className={td} /><td className={td} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              {system.length > 0 && (
                <tbody>
                  <tr><td colSpan={6} className="bg-[var(--bot-band)] px-2.5 py-1.5 text-xs font-semibold text-[var(--bot-ink-mute)]">งานของระบบ (ผู้ใช้ไม่ได้กดเอง)</td></tr>
                  {system.map((r) => (
                    <tr key={r.key}>
                      <td className={td}><span className="font-medium">{r.name}</span><small className="block text-xs text-[var(--bot-ink-mute)]">{r.sub}</small></td>
                      <td className={`${td} max-sm:hidden`} />
                      <td className={`${td} text-right`}>{num(r.calls)} <small className="text-xs text-[var(--bot-ink-mute)]">ครั้งที่เรียก AI</small></td>
                      <td className={`${td} text-right`}>–</td>
                      <td className={`${td} text-right`}>{baht(r.thb)}</td>
                      <td className={`${td} text-right`}>{r.calls ? baht(r.thb / r.calls) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">
          “ครั้ง” คืองานที่ผู้ใช้สั่ง 1 ครั้ง เช่น เขียนโพสต์ 1 รอบ วิดีโอ 1 คลิป ถาม AI 1 คำถาม · ค่า AI คือเงินที่ระบบจ่ายให้ค่าย AI จริง
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className={card}>
          <h2 className="mb-2 text-base font-semibold">ใช้งานรายวัน <span className="text-xs font-normal text-[var(--bot-ink-mute)]">ครั้งต่อวัน · ชี้ที่แท่งเพื่อดูตัวเลข</span></h2>
          <Daily daily={daily} />
        </section>
        <section className={card}>
          <h2 className="mb-2 text-base font-semibold">ค่า AI แยกตามเครื่องมือ</h2>
          {costly.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--bot-ink-mute)]">ไม่มีค่า AI ในช่วงนี้</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {costly.map((t) => (
                <div key={t.key} className="grid grid-cols-[minmax(0,9em)_1fr_auto] items-center gap-2 text-[13.5px]">
                  <span className="truncate">{t.name}</span>
                  <Bar value={t.thb} max={costly[0].thb} />
                  <span className="text-right tabular-nums">{baht(t.thb)} <small className="text-xs text-[var(--bot-ink-mute)]">{Math.round((t.thb / userThb) * 100)}%</small></span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-2 text-base font-semibold">ผู้ใช้ที่ใช้มากที่สุด</h2>
        {people.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--bot-ink-mute)]">ยังไม่มีใครใช้งานในช่วงนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr>
                  <th className={th}>ชื่อ</th>
                  <th className={th}>สังกัด / หน่วย</th>
                  <th className={`${th} text-right`}>ครั้ง</th>
                  <th className={th}>ใช้บ่อยสุด</th>
                  <th className={`${th} text-right`}>ค่า AI</th>
                  <th className={`${th} text-right`}>จ่ายจากกระเป๋า</th>
                </tr>
              </thead>
              <tbody>
                {shownPeople.map((p) => (
                  <tr key={p.agentId}>
                    <td className={td}>{p.name}</td>
                    <td className={td}>
                      {p.member
                        ? <span className="rounded-full border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-2 text-xs text-[var(--bot-sand-ink)]">สมาชิกทั่วไป</span>
                        : p.room ?? "–"}
                    </td>
                    <td className={`${td} text-right`}>{num(p.uses)}</td>
                    <td className={td}>{p.topTool}</td>
                    <td className={`${td} text-right`}>{baht(p.thb)}</td>
                    <td className={`${td} text-right`}>{p.paidSatang ? baht(p.paidSatang / 100) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {people.length > PEOPLE_SHOWN && (
          <button type="button" onClick={() => setEveryone((v) => !v)} className="mt-2 text-sm font-semibold text-[var(--bot-navy)]">
            {everyone ? "แสดงแค่ 5 อันดับแรก ▴" : `ดูทั้งหมดอีก ${people.length - PEOPLE_SHOWN} คน ▾`}
          </button>
        )}
      </section>
    </div>
  );
}

/** one bar a day on one scale; the tooltip names the day and its count */
function Daily({ daily }: { daily: { day: string; uses: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (daily.length === 0) return <p className="py-4 text-center text-sm text-[var(--bot-ink-mute)]">ไม่มีข้อมูล</p>;
  const W = 520, H = 200, L = 32, B = 24, T = 10;
  const peak = Math.max(...daily.map((d) => d.uses));
  const step = peak <= 4 ? 1 : peak <= 20 ? 5 : peak <= 60 ? 15 : Math.ceil(peak / 4 / 10) * 10;
  const top = Math.max(step, Math.ceil(peak / step) * step);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - 4) / daily.length;
  const gap = Math.min(4, bw * 0.25);
  const every = Math.ceil(daily.length / 10);
  const h = hover === null ? null : daily[hover];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`ใช้งานรายวัน ${dayLong(daily[0].day)} – ${dayLong(daily[daily.length - 1].day)}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((g) => (
          <g key={g}>
            <line x1={L} x2={W} y1={y(g)} y2={y(g)} stroke="var(--bot-line)" strokeWidth={1} />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize={11} fill="var(--bot-ink-mute)">{g}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = L + 2 + i * bw;
          const hh = y(0) - y(d.uses);
          const r = Math.min(4, hh, (bw - gap) / 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={T} width={bw} height={H - T - B} fill="transparent" />
              {d.uses > 0 && (
                <path
                  d={`M${x + gap / 2},${y(0)} v${-(hh - r)} q0,${-r} ${r},${-r} h${bw - gap - 2 * r} q${r},0 ${r},${r} v${hh - r} z`}
                  fill="var(--bot-navy)" opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i % every === 0 || i === daily.length - 1) && (
                <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize={11} fill="var(--bot-ink-mute)">{dayNum(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-[var(--bot-ink)] px-2 py-1 text-xs whitespace-nowrap text-[var(--bot-surface)]"
          style={{ left: `${((L + 2 + (hover + 0.5) * bw) / W) * 100}%`, top: `${(y(h.uses) / H) * 100}%` }}
        >
          {dayLong(h.day)} · {num(h.uses)} ครั้ง
        </div>
      )}
    </div>
  );
}
