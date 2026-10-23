"use client";
import { useState, useTransition } from "react";
import { Card } from "../ui";
import { LANES, type LaneEntry, type LaneGroup, type LaneKey } from "@/lib/ai/lanes";
import { saveLanes, type LaneStatus, type LaneView } from "./lanes-actions";

/**
 * ลำดับหลักและสำรอง (owner, 2026-10-21, mockup v3 https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey):
 * four groups, each with its own lanes; the top row of a lane is its main choice, the rest its
 * backups in order. Saved one group at a time.
 */

const GROUPS: { key: LaneGroup; name: string; hint: string; note: string }[] = [
  {
    key: "bot", name: "Autobot", hint: "บอทแชท Messenger · LINE · เว็บ",
    note: "ลูกค้าทักมาทาง Messenger, LINE หรือแชทบนเว็บ บอทใช้สองลำดับนี้ รวมถึงตัวทบทวนแชทจริงที่ใช้ฝึกบอท",
  },
  {
    key: "write", name: "เขียน", hint: "Studio โพสต์ บรีฟคลิป แผนประกัน",
    note: "งานเขียนทั้งหมดนอกบอท: โพสต์ Studio, บรีฟวิดีโอ, คำแนะนำในหน้าวางแผน, สรุปตรวจสุขภาพการเงิน และการอ่านรูปหรือเอกสารที่สมาชิกอัปโหลด",
  },
  {
    key: "image", name: "รูปภาพ", hint: "รูปโพสต์ ภาพปก ภาพในคลิป",
    note: "รูปที่ Studio วาด: รูปโพสต์ ภาพปกคลิป ภาพในคลิปเล่าเรื่อง แบบรูปที่สมาชิกเลือก (มาตรฐาน / คมชัด / Gemini) มาก่อนเสมอ",
  },
  {
    key: "voice", name: "เสียง", hint: "เสียงพากย์คลิป",
    note: "เสียงพากย์ของวิดีโอนำเสนอและคลิปทุกแบบ เสียงที่สมาชิกเลือกมาก่อน ถ้าบริการนั้นใช้ไม่ได้ จะลองตามลำดับนี้",
  },
];

const STATUS: Record<LaneStatus, { text: string; tone: "ok" | "skip" }> = {
  ready: { text: "พร้อม", tone: "ok" },
  "no-key": { text: "ข้าม · ยังไม่มีกุญแจ", tone: "skip" },
  "off-provider": { text: "ข้าม · ปิดค่ายอยู่", tone: "skip" },
  "model-off": { text: "ข้าม · ปิดโมเดลอยู่", tone: "skip" },
};

const UNIT: Record<LaneKey, string> = {
  "bot-small": "ต่อ 1,000 คำตอบ", "bot-large": "ต่อ 1,000 คำตอบ", "write-post": "ต่อชิ้น",
  "write-help": "ต่อ 1,000 งาน", "write-read": "ต่อ 1,000 งาน", "image-plain": "ต่อรูป", "image-face": "ต่อรูป", voice: "ราคา",
};

type Draft = Record<LaneKey, LaneEntry[]>;

export function LanesCard({ lanes, savable, footer }: {
  lanes: LaneView[]; savable: boolean;
  /** the switches that take a model out of every lane at once (./ModelSwitches.tsx) */
  footer?: React.ReactNode;
}) {
  const viewOf = (key: LaneKey) => lanes.find((l) => l.key === key)!;
  const saved = (): Draft => Object.fromEntries(lanes.map((l) => [l.key, l.entries])) as Draft;
  const [draft, setDraft] = useState<Draft>(saved);
  const [group, setGroup] = useState<LaneGroup>("bot");
  const [note, setNote] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  const change = (key: LaneKey, next: LaneEntry[]) => {
    setNote(undefined);
    setDraft((d) => ({ ...d, [key]: next }));
  };
  const move = (key: LaneKey, i: number, by: -1 | 1) => {
    const next = [...draft[key]];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    change(key, next);
  };
  const inGroup = LANES.filter((l) => l.group === group);
  const dirty = inGroup.some((l) => JSON.stringify(draft[l.key]) !== JSON.stringify(viewOf(l.key).entries));

  const save = () => {
    setNote(undefined);
    start(async () => {
      try {
        const res = await saveLanes(inGroup.map((l) => ({ key: l.key, entries: draft[l.key] })));
        const name = GROUPS.find((g) => g.key === group)!.name;
        setNote(res.ok ? { ok: true, text: `บันทึกลำดับหมวด ${name} แล้ว มีผลกับงานใหม่ภายใน 1 นาที` } : { ok: false, text: res.error });
      } catch {
        setNote({ ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" });
      }
    });
  };
  const reset = () => {
    setNote(undefined);
    setDraft((d) => ({ ...d, ...Object.fromEntries(inGroup.map((l) => [l.key, l.defaults.map((id) => ({ id, on: true }))])) }));
  };

  return (
    <Card
      title="ลำดับหลักและสำรอง"
      hint="แต่ละหมวดมีลำดับของตัวเอง แถวบนสุดคือตัวหลัก ถ้าตัวหลักล่ม ช้าเกิน หรือตอบไม่ครบ ระบบจะลองสำรอง 1, 2, 3 ตามลำดับ และใช้เฉพาะแถวที่ติ๊ก “ใช้”"
    >
      <div role="tablist" aria-label="หมวด" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GROUPS.map((g) => {
          const on = g.key === group;
          return (
            <button
              key={g.key} type="button" role="tab" aria-selected={on} id={`lane-group-${g.key}`}
              onClick={() => { setGroup(g.key); setNote(undefined); }}
              className={`rounded-md border px-3 py-2 text-left ${on ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-[var(--bot-surface)]" : "border-[var(--bot-line)] hover:bg-[var(--bot-band)]"}`}
            >
              <span className="block text-sm font-semibold">{g.name}</span>
              <span className={`block text-xs ${on ? "opacity-80" : "text-[var(--bot-ink-mute)]"}`}>{g.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[var(--bot-ink-mute)]">{GROUPS.find((g) => g.key === group)!.note}</p>

      <div className="mt-4 grid gap-5">
        {inGroup.map((def) => {
          const view = viewOf(def.key);
          const rows = draft[def.key];
          const optionOf = (id: string) => view.options.find((o) => o.id === id);
          const addable = view.options.filter((o) => !rows.some((r) => r.id === o.id));
          let rank = 0;
          return (
            <div key={def.key} className="min-w-0">
              <h3 className="text-sm font-semibold">{def.title}</h3>
              <p className="text-xs text-[var(--bot-ink-mute)]">{def.sub}</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bot-line)] text-left text-xs text-[var(--bot-ink-mute)]">
                      <th className="py-1.5 pr-2">ลำดับ</th><th className="py-1.5 pr-2">ตัวเลือก</th><th className="py-1.5 pr-2">ค่าย</th>
                      <th className="py-1.5 pr-2 text-right">{UNIT[def.key]}</th><th className="py-1.5 pr-2">สถานะตอนนี้</th>
                      <th className="py-1.5 pr-2 text-right">30 วัน</th><th className="py-1.5 pr-2">ใช้</th><th className="py-1.5">ย้าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const o = optionOf(r.id);
                      const label = r.on ? (rank++ === 0 ? "หลัก" : `สำรอง ${rank - 1}`) : "–";
                      const st = o ? STATUS[o.status] : { text: "ไม่มีในระบบแล้ว", tone: "skip" as const };
                      return (
                        <tr key={r.id} className={`border-b border-[var(--bot-line)] ${r.on ? "" : "opacity-50"}`}>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            {r.on
                              ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${label === "หลัก" ? "bg-[var(--bot-navy)] text-[var(--bot-surface)]" : "border border-[var(--bot-line-strong)] text-[var(--bot-ink-mute)]"}`}>{label}</span>
                              : label}
                          </td>
                          <td className="py-1.5 pr-2">
                            {o?.name ?? r.id}
                            {o && o.name !== r.id && def.kind === "text" && <span className="ml-1.5 font-mono text-[0.65rem] text-[var(--bot-ink-faint)]">{r.id}</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-xs">{o?.company ?? ""}</td>
                          <td className="py-1.5 pr-2 text-right text-xs tabular-nums whitespace-nowrap">{o?.price ?? ""}</td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            {r.on
                              ? <span className={`rounded-full px-2 py-0.5 text-xs ${st.tone === "ok" ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]"}`}>{st.text}</span>
                              : <span className="text-xs text-[var(--bot-ink-faint)]">ไม่ใช้</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-right text-xs tabular-nums">{(view.used[r.id] ?? 0).toLocaleString("th-TH")}</td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="checkbox" id={`lane-${def.key}-${r.id}`} checked={r.on} aria-label={`ใช้ ${o?.name ?? r.id}`}
                              onChange={(e) => change(def.key, rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                            />
                          </td>
                          <td className="py-1.5">
                            <div className="flex gap-1">
                              <button type="button" aria-label="ย้ายขึ้น" disabled={i === 0} onClick={() => move(def.key, i, -1)}
                                      className="rounded border border-[var(--bot-line-strong)] px-2 text-xs disabled:opacity-30">↑</button>
                              <button type="button" aria-label="ย้ายลง" disabled={i === rows.length - 1} onClick={() => move(def.key, i, 1)}
                                      className="rounded border border-[var(--bot-line-strong)] px-2 text-xs disabled:opacity-30">↓</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {addable.length > 0 && (
                <select
                  id={`lane-add-${def.key}`} value="" aria-label={`เพิ่มเข้าลำดับ ${def.title}`}
                  onChange={(e) => e.target.value && change(def.key, [...rows, { id: e.target.value, on: true }])}
                  className="mt-2 max-w-full rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-1 text-xs"
                >
                  <option value="">+ เพิ่มเข้าลำดับ…</option>
                  {addable.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.company}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {note && (
          <span role="status" className={`text-xs ${note.ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
            {note.ok ? "✓ " : ""}{note.text}
          </span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={reset} disabled={pending}
                className="rounded border border-[var(--bot-line-strong)] px-3 py-1.5 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40">
          กลับเป็นลำดับเดิมของหมวดนี้
        </button>
        <button type="button" onClick={save} disabled={pending || !savable || !dirty}
                className="rounded bg-[var(--bot-navy)] px-3 py-1.5 text-xs text-[var(--bot-surface)] disabled:opacity-40">
          {pending ? "กำลังบันทึก…" : "บันทึกหมวดนี้"}
        </button>
      </div>
      {!savable && <p className="mt-2 text-xs text-[var(--bot-sand-ink)]">ยังบันทึกลำดับไม่ได้ ฐานข้อมูลยังไม่พร้อม ระบบใช้ลำดับเดิมไปก่อน</p>}
      {footer && (
        <div className="mt-5 border-t border-[var(--bot-line)] pt-4">
          <h3 className="text-sm font-semibold">ปิดโมเดลทั้งระบบ</h3>
          <p className="mb-2 text-xs text-[var(--bot-ink-mute)]">ปิดโมเดลที่ไม่ต้องการให้ทุกหมวดข้ามไปพร้อมกัน ต่างจากช่อง “ใช้” ด้านบนที่ข้ามเฉพาะในหมวดนั้น</p>
          {footer}
        </div>
      )}
    </Card>
  );
}
