"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PersonRow } from "@/lib/admin/people-history-read";

/**
 * Everybody who uses the system, searched and sorted in the browser: a few hundred rows, so
 * typing a name filters at once without a trip to the server.
 */

type Group = "all" | "agent" | "member";
type Sort = "recent" | "uses" | "spent" | "balance";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const TZ = "Asia/Bangkok";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function when(iso: string | null, now: Date): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  if (ymd(d) === ymd(now)) return `วันนี้ ${time}`;
  if (ymd(d) === ymd(new Date(now.getTime() - 86_400_000))) return `เมื่อวาน ${time}`;
  return `${d.toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short" })} ${time}`;
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-[13px] ${on
    ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
    : "border-[var(--bot-line)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]"}`;
const field = "rounded-md border border-[var(--bot-line)] bg-[var(--bot-surface)] px-2.5 py-1.5 text-sm text-[var(--bot-ink)]";

export function PeopleTable({ people, nowIso }: { people: PersonRow[]; nowIso: string }) {
  const now = new Date(nowIso);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [room, setRoom] = useState("");
  const [unit, setUnit] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const rooms = useMemo(() => [...new Set(people.map((p) => p.room).filter((r): r is string => Boolean(r)))].sort(), [people]);
  const units = useMemo(() => [...new Set(people.filter((p) => !room || p.room === room).map((p) => p.unit).filter((u): u is string => Boolean(u)))].sort(), [people, room]);
  const counts = { all: people.length, agent: people.filter((p) => !p.member).length, member: people.filter((p) => p.member).length };

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = people.filter((p) => {
      if (group === "agent" && p.member) return false;
      if (group === "member" && !p.member) return false;
      if (room && p.room !== room) return false;
      if (unit && p.unit !== unit) return false;
      const hay = `${p.name} ${p.code ?? ""} ${p.room ?? ""} ${p.unit ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const key: Record<Sort, (p: PersonRow) => number> = {
      recent: (p) => Math.max(p.lastLogin ? Date.parse(p.lastLogin) : 0, p.uses30 ? 1 : 0),
      uses: (p) => p.uses30,
      spent: (p) => p.spent30,
      balance: (p) => p.balanceSatang ?? -1,
    };
    return [...rows].sort((a, b) => key[sort](b) - key[sort](a) || b.uses30 - a.uses30 || a.name.localeCompare(b.name, "th"));
  }, [people, q, group, room, unit, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-3">
        <input
          id="people-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นชื่อ / รหัสตัวแทน / สังกัด"
          className={`${field} min-w-0 flex-[1_1_220px]`} aria-label="ค้นหา"
        />
        {(["all", "agent", "member"] as const).map((g) => (
          <button key={g} type="button" className={chip(group === g)} onClick={() => setGroup(g)}>
            {g === "all" ? "ทุกคน" : g === "agent" ? "ตัวแทน" : "สมาชิกทั่วไป"} {counts[g]}
          </button>
        ))}
        <select id="people-room" className={field} value={room} onChange={(e) => { setRoom(e.target.value); setUnit(""); }} aria-label="สังกัด">
          <option value="">ทุกสังกัด</option>
          {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select id="people-unit" className={field} value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="หน่วย">
          <option value="">ทุกหน่วย</option>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select id="people-sort" className={field} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="เรียง">
          <option value="recent">เข้าระบบล่าสุดก่อน</option>
          <option value="uses">ใช้งานมากสุดก่อน</option>
          <option value="spent">ใช้เงินมากสุดก่อน</option>
          <option value="balance">ยอดคงเหลือมากสุดก่อน</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)]">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="bg-[var(--bot-navy)] text-left text-white">
              {["ชื่อ", "กลุ่ม", "สังกัด · หน่วย", "เข้าระบบล่าสุด"].map((h) => <th key={h} className="px-2.5 py-2 font-medium whitespace-nowrap">{h}</th>)}
              {["ใช้งาน 30 วัน", "ค่า AI 30 วัน", "เติมเงิน 30 วัน", "ใช้ไป 30 วัน", "ยอดคงเหลือ"].map((h) => <th key={h} className="px-2.5 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-[var(--bot-line)] align-top">
                <td className="px-2.5 py-2">
                  <Link href={`/admin/history/${p.id}`} className="font-medium text-[var(--bot-navy)] underline">{p.name}</Link>
                  {p.code && <div className="text-xs text-[var(--bot-ink-mute)]">{p.code}</div>}
                </td>
                <td className="px-2.5 py-2">
                  <span className={`rounded-full border px-2 text-xs whitespace-nowrap ${p.member ? "border-[var(--bot-line)] bg-[var(--bot-band)]" : "border-[var(--bot-blue)] bg-[var(--bot-navy-soft)] text-[var(--bot-navy)]"}`}>
                    {p.member ? "สมาชิกทั่วไป" : "ตัวแทน"}
                  </span>
                </td>
                <td className="px-2.5 py-2">{[p.room, p.unit].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2.5 py-2 whitespace-nowrap">{when(p.lastLogin, now)}</td>
                <td className="px-2.5 py-2 text-right">{p.uses30 || "—"}</td>
                <td className="px-2.5 py-2 text-right">{p.aiThb30 ? `฿${p.aiThb30.toFixed(2)}` : "—"}</td>
                <td className="px-2.5 py-2 text-right" style={{ color: p.toppedUp30 ? "var(--bot-ok)" : undefined }}>{p.toppedUp30 ? baht(p.toppedUp30) : "—"}</td>
                <td className="px-2.5 py-2 text-right" style={{ color: p.spent30 ? "var(--bot-red-ink)" : undefined }}>{p.spent30 ? baht(Math.abs(p.spent30)) : "—"}</td>
                <td className="px-2.5 py-2 text-right">{p.balanceSatang === null ? "—" : `฿${(p.balanceSatang / 100).toFixed(2)}`}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={9} className="px-2.5 py-6 text-center text-[var(--bot-ink-mute)]">ไม่พบคนที่ค้นหา</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--bot-ink-mute)]">
        แสดง {shown.length} จาก {people.length} คน · เข้าระบบล่าสุดเริ่มเก็บตั้งแต่ 15 ต.ค. 2569 · ใช้งาน 30 วันนับทุกเครื่องมือ (Studio คลิป FHC แอด ถาม AI เครื่องคิดเบี้ย)
      </p>
    </div>
  );
}
