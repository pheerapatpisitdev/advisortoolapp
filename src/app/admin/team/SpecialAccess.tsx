"use client";
import { useState, useTransition } from "react";
import { addSpecial, lookUpSpecial, removeSpecial, setSpecialBudget, type SpecialMember } from "./special-actions";
import { Empty } from "../ui";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * สิทธิ์เข้าพิเศษ (owner, 2026-10-20; mockup KRqC5VJg): add by code in two steps, as ผู้ช่วย is,
 * so a mistyped digit shows somebody else's name before anything is given.
 */
export function SpecialAccess({ rows }: { rows: SpecialMember[] }) {
  const [code, setCode] = useState("");
  const [budget, setBudget] = useState("100");
  const [found, setFound] = useState<{ name: string; room: string; locked: boolean } | null>(null);
  const [editing, setEditing] = useState<{ agentId: string; value: string } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setError(undefined);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "ทำรายการไม่สำเร็จ");
      else after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    }
  });

  const input = "mt-1 block rounded border border-[var(--bot-line)] px-2 py-1.5 text-sm tabular-nums text-[var(--bot-ink)]";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--bot-ink-mute)]">
          รหัสตัวแทน 6 หลัก
          <input
            id="special-code" value={code} inputMode="numeric" maxLength={6} placeholder="000000"
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setFound(null); setError(undefined); }}
            className={`${input} w-36`}
          />
        </label>
        {!found ? (
          <button
            type="button" disabled={pending || code.length !== 6}
            onClick={() => start(async () => {
              setError(undefined);
              const r = await lookUpSpecial(code);
              if (r.ok) setFound({ name: r.name, room: r.room, locked: r.locked }); else setError(r.error);
            })}
            className="rounded border border-[var(--bot-line)] px-3 py-2 text-sm text-[var(--bot-ink)] disabled:opacity-40"
          >
            {pending ? "กำลังหา…" : "ค้นหา"}
          </button>
        ) : (
          <>
            <span className="self-center text-sm text-[var(--bot-ink)]">
              {found.name} <span className="text-[var(--bot-ink-mute)]">· ห้อง {found.room}{found.locked ? " · ติดล็อก Premium" : ""}</span>
            </span>
            <label className="text-xs text-[var(--bot-ink-mute)]">
              งบพิเศษต่อเดือน (บาท)
              <input id="special-budget" value={budget} inputMode="numeric" onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} className={`${input} w-28`} />
            </label>
            <button
              type="button" disabled={pending || budget === ""}
              onClick={() => run(() => addSpecial(code, budget), () => { setCode(""); setFound(null); setBudget("100"); })}
              className="rounded bg-[var(--bot-navy)] px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              ให้สิทธิ์
            </button>
            <button type="button" onClick={() => setFound(null)} className="self-center text-xs text-[var(--bot-ink-mute)] underline">ยกเลิก</button>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-[var(--bot-red-ink)]">{error}</p>}

      {rows.length === 0 ? <Empty>ยังไม่มีใครได้สิทธิ์เข้าพิเศษ</Empty> : (
        <ul className="divide-y divide-[var(--bot-line)] rounded-lg border border-[var(--bot-line)]">
          {rows.map((m) => {
            const of = m.month?.amountSatang ?? m.monthlySatang;
            const used = m.month ? m.month.amountSatang - m.month.leftSatang : 0;
            const pct = of > 0 ? Math.min(100, Math.round((used / of) * 100)) : 0;
            return (
              <li key={m.agentId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium text-[var(--bot-ink)]">{m.name}</p>
                  <p className="text-xs text-[var(--bot-ink-mute)]">
                    {m.code} · ห้อง {m.room} · ให้สิทธิ์ {new Date(m.since).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    {m.locked ? "" : " · ตอนนี้ไม่ติดล็อก Premium"}
                  </p>
                </div>
                <div className="min-w-36">
                  <p className="text-xs tabular-nums text-[var(--bot-ink-mute)]">งบเดือนนี้ใช้ {baht(used)} / {baht(of)}</p>
                  <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-[var(--bot-line)]">
                    <div className="h-full bg-[var(--bot-navy)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {editing?.agentId === m.agentId ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <input
                      id={`special-edit-${m.agentId}`} aria-label={`งบต่อเดือนของ ${m.name}`} value={editing.value} inputMode="numeric"
                      onChange={(e) => setEditing({ agentId: m.agentId, value: e.target.value.replace(/[^\d]/g, "") })}
                      className="w-24 rounded border border-[var(--bot-line)] px-2 py-1 text-sm tabular-nums text-[var(--bot-ink)]"
                    />
                    <button
                      type="button" disabled={pending || editing.value === ""}
                      onClick={() => run(() => setSpecialBudget(m.agentId, editing.value), () => setEditing(null))}
                      className="rounded bg-[var(--bot-navy)] px-2 py-1 text-xs text-white disabled:opacity-40"
                    >
                      บันทึก
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="text-xs text-[var(--bot-ink-mute)] underline">ยกเลิก</button>
                  </span>
                ) : (
                  <button
                    type="button" disabled={pending}
                    onClick={() => setEditing({ agentId: m.agentId, value: String(m.monthlySatang / 100) })}
                    className="rounded border border-[var(--bot-line)] px-2 py-1 text-xs text-[var(--bot-ink)] disabled:opacity-50"
                  >
                    แก้งบ
                  </button>
                )}
                <button
                  type="button" disabled={pending}
                  onClick={() => run(() => removeSpecial(m.agentId))}
                  className="rounded border border-[var(--bot-red)] px-2 py-1 text-xs text-[var(--bot-red-ink)] disabled:opacity-50"
                >
                  เอาออก
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
