"use client";
import { useState, useTransition } from "react";
import { addStaff, lookUpAgent, removeStaff, setStaffFlags, type StaffMember } from "./actions";
import { Empty } from "../ui";

type Flag = "publish" | "connect" | "admin";
const FLAGS: { key: Flag; label: string; hint: string }[] = [
  { key: "publish", label: "ลงโพสต์ / ตั้งเวลา", hint: "ปฏิทินโพสต์ และส่งโพสต์ขึ้นเพจ" },
  { key: "connect", label: "เชื่อมเพจ", hint: "เชื่อมหรือตัดการเชื่อมเพจกับระบบ" },
  { key: "admin", label: "หลังบ้าน", hint: "ลูกค้า, ตั้งค่า AI, สอน AI, ADS, MCP" },
];

/**
 * Adding an assistant is two steps on purpose: the code is looked up and the person's name and
 * room are shown before เพิ่ม, because a mistyped digit is somebody else in UnitOS.
 */
export function Team({ rows }: { rows: StaffMember[] }) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ name: string; room: string } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setError(undefined);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "ทำรายการไม่สำเร็จ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    }
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--bot-ink-mute)]">
          รหัสตัวแทน 6 หลัก
          <input
            value={code} inputMode="numeric" maxLength={6} placeholder="000000"
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setFound(null); setError(undefined); }}
            className="mt-1 block w-36 rounded border border-[var(--bot-line)] px-2 py-1.5 text-sm tabular-nums text-[var(--bot-ink)]"
          />
        </label>
        {!found ? (
          <button
            type="button" disabled={pending || code.length !== 6}
            onClick={() => start(async () => {
              setError(undefined);
              const r = await lookUpAgent(code);
              if (r.ok) setFound({ name: r.name, room: r.room }); else setError(r.error);
            })}
            className="rounded border border-[var(--bot-line)] px-3 py-2 text-sm text-[var(--bot-ink)] disabled:opacity-40"
          >
            {pending ? "กำลังหา…" : "ค้นหา"}
          </button>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--bot-ink)]">{found.name} <span className="text-[var(--bot-ink-mute)]">· ห้อง {found.room}</span></span>
            <button
              type="button" disabled={pending}
              onClick={() => run(async () => {
                const r = await addStaff(code);
                if (r.ok) { setCode(""); setFound(null); }
                return r;
              })}
              className="rounded bg-[var(--bot-navy)] px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              เพิ่มเข้าทีมงาน
            </button>
            <button type="button" onClick={() => setFound(null)} className="text-xs text-[var(--bot-ink-mute)] underline">ยกเลิก</button>
          </span>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-[var(--bot-red-ink)]">{error}</p>}

      {rows.length === 0 ? <Empty>ยังไม่มีทีมงาน</Empty> : (
        <ul className="divide-y divide-[var(--bot-line)] rounded-lg border border-[var(--bot-line)]">
          {rows.map((m) => (
            <li key={m.agentId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium text-[var(--bot-ink)]">{m.name}</p>
                <p className="text-xs text-[var(--bot-ink-mute)]">{m.code} · ห้อง {m.room}</p>
              </div>
              {m.owner ? (
                <span className="rounded bg-[var(--bot-panel)] px-2 py-1 text-xs text-[var(--bot-ink-mute)]">เจ้าของ — ทำได้ทุกอย่าง</span>
              ) : (
                <>
                  {FLAGS.map((f) => (
                    <label key={f.key} title={f.hint} className="inline-flex items-center gap-1.5 text-xs text-[var(--bot-ink)]">
                      <input
                        type="checkbox" checked={m[f.key]} disabled={pending}
                        onChange={(e) => run(() => setStaffFlags(m.agentId, {
                          publish: m.publish, connect: m.connect, admin: m.admin, [f.key]: e.target.checked,
                        }))}
                      />
                      {f.label}
                    </label>
                  ))}
                  <button
                    type="button" disabled={pending}
                    onClick={() => run(() => removeStaff(m.agentId))}
                    className="rounded border border-[var(--bot-red)] px-2 py-1 text-xs text-[var(--bot-red-ink)] disabled:opacity-50"
                  >
                    เอาออก
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
