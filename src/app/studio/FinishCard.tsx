"use client";
import { useState } from "react";
import { SHARE_WHY } from "@/lib/content/finish";
import { finishChecks, ticksFor, type FinishFormat } from "@/lib/content/finish-check";
import type { ContentOutput } from "@/lib/content/output";
import type { ContentItem } from "@/lib/content/store";
import { saveFinishTicks } from "./ticks";
import { AlertIcon, CheckIcon } from "./ui/editor-icons";

/**
 * สูตรอ่าน-ดูจนจบ's checklist, beside the other checks (finish-check.ts). The code's half is
 * read from `output` — the words on screen as they are typed, not the last save. The agent's
 * half is ticked here and kept with the piece. It warns and never blocks: the owner decides.
 */
export function FinishCard({ item, output, format, onSaved }: {
  item: ContentItem;
  output: ContentOutput;
  format: FinishFormat;
  onSaved: (item: ContentItem) => void;
}) {
  const results = finishChecks(output, format);
  const ticks = ticksFor(format);
  const [done, setDone] = useState<string[]>(item.output.finishTicks ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passed = results.filter((r) => r.ok).length;
  const ticked = ticks.filter((t) => done.includes(t.id)).length;
  const share = item.output.shareWhy ? SHARE_WHY[item.output.shareWhy].label : "ไม่ระบุ";

  async function toggle(id: string) {
    const before = done;
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    setSaving(true);
    setError(null);
    const res = await saveFinishTicks(item.id, next).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setDone(before);
      setError(res && !res.ok ? res.error : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
      return;
    }
    onSaved(res.item);
  }

  return (
    <section aria-label="เช็กลิสต์สูตรอ่าน-ดูจนจบ" className="mt-4 rounded-lg border border-[var(--ct-line)] p-3 text-sm">
      <p className="font-medium">เช็กลิสต์สูตรอ่าน-ดูจนจบ</p>
      <p className="mt-0.5 text-xs text-[var(--ct-mute)]">ตรวจอัตโนมัติผ่าน {passed}/{results.length} · ติ๊กแล้ว {ticked}/{ticks.length}</p>
      <ul className="mt-2 space-y-1.5">
        {results.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            {r.ok
              ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-[var(--ct-accent)]" />
              : <AlertIcon className="mt-0.5 size-4 shrink-0 text-[var(--ct-warn-ink)]" />}
            <span>
              <span className="sr-only">{r.ok ? "ผ่าน: " : "ยังไม่ผ่าน: "}</span>
              {r.label}
              {!r.ok && r.where.length > 0 && (
                <span className="mt-0.5 block text-xs text-[var(--ct-warn-ink)]">{r.where.join(" · ")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium text-[var(--ct-mute)]">ติ๊กเอง (ระบบตรวจแทนไม่ได้)</p>
      <ul className="mt-1">
        {ticks.map((t) => (
          <li key={t.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={done.includes(t.id)} disabled={saving} onChange={() => void toggle(t.id)} className="size-5 shrink-0" />
              <span>
                {t.label}
                {t.id === "share-reason" && <span className="text-[var(--ct-mute)]"> (ชิ้นนี้: {share})</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-[var(--ct-alert)]">{error}</p>}
    </section>
  );
}
