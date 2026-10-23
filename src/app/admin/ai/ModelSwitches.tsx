"use client";
import { useState, useTransition } from "react";
import { Empty } from "../ui";
import { setModelEnabled, type ModelRow } from "./actions";
import { PROVIDER_LABEL } from "./labels";

/**
 * The switch that takes a model out of every lane at once, the "โมเดล" card of /admin/ai until
 * 2026-10-23 (owner chose ก, mockup https://claude.ai/artifact/1MZqF78ZXVU64Pv5wPzh2u): it now sits
 * at the foot of ลำดับหลักและสำรอง, where a lane row that says "ข้าม · ปิดโมเดลอยู่" sends the reader.
 * It is not the lane's own ใช้ box: that one skips a model in one lane, this one in all of them.
 */

/** How a model's kind reads on the page. A judge answers in probabilities, never in words. */
const KIND_LABEL: Record<string, string> = { text: "ข้อความ", image: "รูปภาพ", judge: "ตัดสิน (ไม่สร้างข้อความ)" };

/** The quality an image row is asked for, so one model at two prices reads as two choices. */
const QUALITY_LABEL: Record<string, string> = { low: "คุณภาพต่ำ", medium: "คุณภาพมาตรฐาน", high: "คุณภาพสูง (คมชัด)" };

export function ModelSwitches({ models }: { models: ModelRow[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string>();
  const [note, setNote] = useState<{ id: string; ok: boolean; text: string }>();

  const flip = (id: string, on: boolean) => {
    setNote(undefined);
    setBusy(id);
    start(async () => {
      try {
        const res = await setModelEnabled(id, on);
        setNote(res.ok ? { id, ok: true, text: `${on ? "เปิด" : "ปิด"}แล้ว` } : { id, ok: false, text: res.error });
      } catch {
        setNote({ id, ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" });
      } finally {
        setBusy(undefined);
      }
    });
  };

  if (models.length === 0) return <Empty>ยังไม่มีโมเดลในระบบ</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[var(--bot-line)] text-left text-[var(--bot-ink-mute)]"><th className="py-2">ค่าย</th><th className="py-2 pl-3">ประเภท</th><th className="py-2 pl-3">โมเดล</th><th className="py-2 pl-3">ใช้งาน</th></tr></thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id} className="border-b border-[var(--bot-line)]">
              <td className="py-1.5">{PROVIDER_LABEL[m.provider] ?? m.provider}</td>
              <td className="py-1.5 pl-3">{KIND_LABEL[m.kind] ?? m.kind}</td>
              <td className="py-1.5 pl-3">
                <span className="font-mono text-xs">{m.model_name}</span>
                {m.quality && <span className="ml-1.5 text-xs text-[var(--bot-ink-mute)]">· {QUALITY_LABEL[m.quality] ?? m.quality}</span>}
              </td>
              <td className="py-1.5 pl-3">
                <input
                  type="checkbox" id={`model-${m.id}`} checked={m.enabled} disabled={pending || m.kind === "judge"}
                  aria-label={`ใช้งาน ${m.model_name}`}
                  title={m.kind === "judge" ? "ยังไม่มีงานไหนเรียกใช้ เปิดปิดด้วยการใส่หรือลบกุญแจ" : undefined}
                  onChange={(e) => flip(m.id, e.target.checked)}
                />
                {busy === m.id && <span className="ml-1.5 text-xs text-[var(--bot-ink-mute)]">กำลังบันทึก…</span>}
                {note?.id === m.id && (
                  <span role="status" className={`ml-1.5 text-xs ${note.ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
                    {note.ok ? "✓ " : ""}{note.text}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
