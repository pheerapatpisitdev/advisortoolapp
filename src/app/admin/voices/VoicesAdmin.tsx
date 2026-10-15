"use client";
import { useState } from "react";
import type { Slots } from "@/lib/voice/clone";
import { Card, Empty } from "../ui";
import { approveAgentVoice, rejectAgentVoice, type Result } from "./actions";

const REASONS = ["เสียงไม่ตรงกับเจ้าของบัญชี", "ประโยคยินยอมไม่ครบหรือรหัสไม่ตรง", "เสียงไม่ชัด มีเสียงรบกวน", "อื่น ๆ"];
const BTN = "rounded-md bg-[var(--bot-navy)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const GHOST = "rounded-md border border-[var(--bot-line)] px-3 py-1.5 text-sm disabled:opacity-50";

export function VoicesAdmin({ slots, queue, active }: {
  slots: Slots | null;
  queue: { id: string; name: string; sex: "F" | "M"; code: string; consentText: string; preview: string | null; consent: string | null; charged: number; inUse: boolean }[];
  active: { id: string; name: string; sex: "F" | "M" }[];
}) {
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(run: () => Promise<Result>) {
    setBusy(true);
    setMsg(null);
    const r = await run().catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(false);
    if (!r.ok) setMsg(r.error);
  }

  const pct = slots && slots.limit > 0 ? Math.min(100, Math.round((slots.used / slots.limit) * 100)) : 0;
  return (
    <>
      {msg && <p role="alert" className="mb-4 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">{msg}</p>}
      <Card title="ช่องเสียงโคลนในบัญชี ElevenLabs" hint="อ่านจาก ElevenLabs ตอนเปิดหน้านี้ · เต็มเมื่อไร ตัวแทนโคลนเสียงใหม่ไม่ได้จนกว่าจะมีช่องว่าง">
        {slots ? (
          <div className="max-w-md space-y-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bot-line)]"><div className="h-full bg-[var(--bot-navy)]" style={{ width: `${pct}%` }} /></div>
            <p className="text-sm tabular-nums">ใช้ไป {slots.used} จาก {slots.limit || "ไม่ทราบ"} ช่อง · เสียงตัวแทนที่ใช้งานอยู่ {active.length}</p>
          </div>
        ) : <Empty>อ่านช่องเสียงไม่ได้ ตรวจคีย์ ElevenLabs ในหน้าตั้งค่า AI และระบบ</Empty>}
      </Card>

      <Card title={`ยังไม่ได้ฟัง (${queue.length})`} hint="ตัวแทนใช้เสียงเหล่านี้ทำคลิปได้แล้ว ฟังเสียงโคลน และท่อนที่อ่านประโยคยินยอม ชื่อต้องตรงกับบัญชี รหัสต้องตรง · ปิดเสียง: ระบบลบเสียงและคืนเงินเอง">
        {queue.length === 0 ? <Empty>ฟังครบทุกเสียงแล้ว</Empty> : (
          <ul className="space-y-4">
            {queue.map((v) => (
              <li key={v.id} className="space-y-2 rounded-md border border-[var(--bot-line)] p-3">
                <div className="flex flex-wrap items-baseline gap-x-3"><b>{v.name}</b>{!v.inUse && <span className="text-xs font-medium">รออนุมัติ (จากช่วงนำร่อง)</span>}<span className="text-xs text-[var(--bot-ink-mute)]">เสียง{v.sex === "F" ? "ผู้หญิง" : "ผู้ชาย"} · รหัส {v.code} · จ่าย ฿{(v.charged / 100).toLocaleString("en-US")}</span></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><span className="text-xs text-[var(--bot-ink-mute)]">เสียงโคลน</span>{v.preview ? <audio controls src={v.preview} className="w-full" /> : <p className="text-sm">ไม่มีตัวอย่าง</p>}</div>
                  <div><span className="text-xs text-[var(--bot-ink-mute)]">ท่อนยินยอม (เสียงจริง)</span>{v.consent ? <audio controls src={v.consent} className="w-full" /> : <p className="text-sm">ไม่มีไฟล์</p>}</div>
                </div>
                <p className="text-xs text-[var(--bot-ink-mute)]">ต้องอ่านว่า: “{v.consentText}”</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={BTN} disabled={busy} onClick={() => act(() => approveAgentVoice(v.id))}>{v.inUse ? "ฟังแล้ว ผ่าน" : "อนุมัติ"}</button>
                  <select aria-label="เหตุผลที่ปิดเสียง" className="rounded-md border border-[var(--bot-line)] px-2 py-1.5 text-sm" value={reason[v.id] ?? ""} onChange={(e) => setReason({ ...reason, [v.id]: e.target.value })}>
                    <option value="">เหตุผลที่ปิดเสียง…</option>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button type="button" className={GHOST} disabled={busy || !reason[v.id]} onClick={() => act(() => rejectAgentVoice(v.id, reason[v.id]))}>ปิดเสียงนี้</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`เสียงที่ใช้งานอยู่ (${active.length})`}>
        {active.length === 0 ? <Empty>ยังไม่มี</Empty> : <p className="text-sm">{active.map((a) => `${a.name} (${a.sex === "F" ? "หญิง" : "ชาย"})`).join(" · ")}</p>}
      </Card>
    </>
  );
}
