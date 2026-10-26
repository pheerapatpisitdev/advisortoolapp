"use client";
import { SCREEN_MAX, TITLE_MAX, type PromptScene } from "@/lib/prompt-story/types";

/**
 * The script the AI wrote, every box editable (owner's mockup, 2026-10-16, state 2): per scene the
 * words said, the words on the screen and the picture wanted. A scene that shows the plan's real
 * premium has its screen words drawn by the system, so that box is shut.
 */

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm disabled:opacity-60";
const VOICE_MAX = 400;
const PICTURE_MAX = 300;

export interface Draft { id: string; title: string; caption: string; scenes: PromptScene[] }

export function ScriptEditor({ draft, notes, onChange }: {
  draft: Draft;
  /** scenes (from 0) the writer had to make plain: the agent is told */
  notes: number[];
  onChange: (next: Draft) => void;
}) {
  const setScene = (i: number, patch: Partial<PromptScene>) =>
    onChange({ ...draft, scenes: draft.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ชื่อเรื่อง</span>
          <input className={field} maxLength={TITLE_MAX} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ข้อความโพสต์</span>
          <textarea className={field} rows={2} maxLength={400} value={draft.caption} onChange={(e) => onChange({ ...draft, caption: e.target.value })} />
        </label>
        <p className="text-xs text-[var(--ct-mute)]">เห็นเฉพาะบท รูปจะวาดตอนกดสร้างคลิป · ตรวจแล้ว: เลขทุกตัวมาจากโจทย์หรือตาราง</p>
        {notes.length > 0 && (
          <p role="status" className="rounded-lg bg-[var(--ct-warn-bg)] px-3 py-2 text-xs text-[var(--ct-warn-ink)]">
            ฉากที่ {notes.map((n) => n + 1).join(", ")} AI เขียนเกินกติกา ระบบเปลี่ยนเป็นข้อความกลาง ๆ แก้ได้ตามต้องการ
          </p>
        )}
      </div>
      {draft.scenes.map((s, i) => (
        <div key={i} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
          <b className="text-[var(--ct-accent)]">{i + 1}</b>
          <div className="space-y-1.5">
            <textarea aria-label={`บทพูดฉาก ${i + 1}`} className={field} rows={2} maxLength={VOICE_MAX} value={s.voice} onChange={(e) => setScene(i, { voice: e.target.value })} />
            <input
              aria-label={`คำบนจอฉาก ${i + 1}`} className={field} maxLength={SCREEN_MAX} disabled={s.showFigure}
              value={s.showFigure ? "การ์ดเบี้ยจริง (ระบบวาด)" : s.screen} onChange={(e) => setScene(i, { screen: e.target.value })}
            />
            <input aria-label={`ภาพฉาก ${i + 1}`} className={field} maxLength={PICTURE_MAX} value={s.picture} onChange={(e) => setScene(i, { picture: e.target.value })} />
          </div>
        </div>
      ))}
      <p className="text-xs text-[var(--ct-mute)]">ตามด้วยการ์ดตัวแทน (ฉากสุดท้าย) อัตโนมัติ · ถ้าแก้บทแล้วใส่เลขที่ไม่อยู่ในโจทย์หรือตาราง ระบบจะบอกว่าฉากไหน และไม่เก็บเงิน</p>
    </div>
  );
}
