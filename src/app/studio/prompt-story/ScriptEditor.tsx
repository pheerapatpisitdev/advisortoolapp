"use client";
import { useEffect, useRef, useState } from "react";
import { deviceFields, missingPicture, needPictureWords, rewritesLeft, sceneKind, setDeviceWord, toPicture } from "@/lib/prompt-story/editor-state";
import { REWRITES_DONE, REWRITES_PER_DRAFT, SCREEN_MAX, TITLE_MAX, type DeviceScene, type PromptScene } from "@/lib/prompt-story/types";
import { rewritePromptScene } from "./actions";

/**
 * The script the AI wrote, every box editable (owner's mockup, 2026-10-16, state 2): per scene the
 * words said, the words on the screen and the picture wanted. A scene that shows the plan's real
 * premium has its screen words drawn by the system, so that box is shut.
 *
 * Health devices (2026-11-13, Task 10): a scene is "ภาพ AI" or a device the writer chose, its words
 * editable and its figures shown as they are; a device the server would drop says why and is priced as
 * a picture. ภาพ AI ↔ อุปกรณ์ switches a scene (a device only comes from the writer: "เขียนฉากนี้ใหม่",
 * free, REWRITES_PER_DRAFT a draft).
 */

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm disabled:opacity-60";
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const VOICE_MAX = 400;
const PICTURE_MAX = 300;

export interface Draft {
  id: string;
  title: string;
  caption: string;
  scenes: PromptScene[];
  /** เขียนฉากนี้ใหม่ left on this draft; none = all of them */
  left?: number;
  /** a device the agent turned into ภาพ AI, by scene (from 0): อุปกรณ์ brings it back */
  parked?: Record<number, DeviceScene>;
}

export function ScriptEditor({ draft, notes, onChange, forDevice }: {
  draft: Draft;
  /** scenes (from 0) the writer had to make plain: the agent is told */
  notes: number[];
  onChange: (next: Draft) => void;
  /** the figures a device may show: deviceAllowed of the brief and plan the script was written from */
  forDevice: Set<number>;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [said, setSaid] = useState<Record<number, string>>({});
  /** scenes whose อุปกรณ์ was pressed with no device to bring back: told to ask the writer */
  const [asked, setAsked] = useState<Record<number, boolean>>({});
  // the draft as it is now, for an answer that comes back after the agent kept typing
  const latest = useRef(draft);
  useEffect(() => { latest.current = draft; });

  const left = draft.left ?? REWRITES_PER_DRAFT;
  const kinds = draft.scenes.map((s) => sceneKind(s, forDevice));
  const devices = kinds.filter((k) => k.kind === "device").length;
  const missing = missingPicture(draft.scenes, forDevice);

  const setScene = (i: number, patch: Partial<PromptScene>) =>
    onChange({ ...draft, scenes: draft.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  function toPictureAt(i: number) {
    const s = draft.scenes[i];
    if (!s.device) return;
    onChange({ ...draft, scenes: draft.scenes.map((x, j) => (j === i ? toPicture(x) : x)), parked: { ...draft.parked, [i]: s.device } });
  }
  function toDeviceAt(i: number) {
    const kept = draft.parked?.[i];
    if (draft.scenes[i].device) return;
    if (!kept) {
      setAsked((a) => ({ ...a, [i]: true }));
      return;
    }
    const parked = { ...draft.parked };
    delete parked[i];
    onChange({ ...draft, scenes: draft.scenes.map((x, j) => (j === i ? { ...x, device: kept } : x)), parked });
  }

  async function rewrite(i: number) {
    const id = draft.id;
    setBusy(i);
    setSaid((m) => ({ ...m, [i]: "" }));
    try {
      const r = await rewritePromptScene(id, i);
      const now = latest.current;
      // a new script written meanwhile: this answer is for the old one
      if (now.id !== id) return;
      const nextLeft = rewritesLeft(now.left ?? REWRITES_PER_DRAFT, r, REWRITES_DONE);
      if (r.ok) {
        const parked = { ...now.parked };
        delete parked[i];
        onChange({ ...now, scenes: now.scenes.map((x, j) => (j === i ? r.scene : x)), left: nextLeft, parked });
        setAsked((a) => ({ ...a, [i]: false }));
      } else {
        onChange({ ...now, left: nextLeft });
        setSaid((m) => ({ ...m, [i]: r.error }));
      }
    } catch {
      setSaid((m) => ({ ...m, [i]: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    } finally {
      setBusy(null);
    }
  }

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
        <p className="text-xs text-[var(--ct-mute)] tabular-nums">
          ภาพ AI {draft.scenes.length - devices} ฉาก{devices > 0 && ` · อุปกรณ์ ${devices} ฉาก (ระบบวาด ไม่คิดค่ารูป)`}
          {" · "}เขียนฉากนี้ใหม่ได้อีก {left} ครั้ง (ฟรี นับแม้เขียนไม่สำเร็จ)
        </p>
        {notes.length > 0 && (
          <p role="status" className="rounded-lg bg-[var(--ct-warn-bg)] px-3 py-2 text-xs text-[var(--ct-warn-ink)]">
            ฉากที่ {notes.map((n) => n + 1).join(", ")} AI เขียนเกินกติกา ระบบเปลี่ยนเป็นข้อความกลาง ๆ แก้ได้ตามต้องการ
          </p>
        )}
      </div>
      {draft.scenes.map((s, i) => {
        const k = kinds[i];
        const isDevice = k.kind === "device";
        const fields = s.device ? deviceFields(s.device) : null;
        return (
          <div key={i} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
            <b className="text-[var(--ct-accent)]">{i + 1}</b>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`ภาพของฉาก ${i + 1}`}>
                  <button type="button" role="radio" aria-checked={!isDevice} className={chip(!isDevice)} onClick={() => toPictureAt(i)}>ภาพ AI</button>
                  <button type="button" role="radio" aria-checked={isDevice} className={chip(isDevice)} onClick={() => toDeviceAt(i)}>
                    {isDevice ? k.name : "อุปกรณ์"}
                  </button>
                </div>
                <button
                  type="button" onClick={() => rewrite(i)} disabled={busy !== null || left <= 0} aria-label={`เขียนฉาก ${i + 1} ใหม่ (เหลือ ${left})`}
                  className="ml-auto min-h-11 rounded-lg border border-[var(--ct-accent)] px-3 text-sm text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50"
                >
                  {busy === i ? "กำลังเขียน…" : left <= 0 ? "เขียนฉากใหม่ครบแล้ว" : `เขียนฉากนี้ใหม่ (เหลือ ${left})`}
                </button>
              </div>
              <textarea aria-label={`บทพูดฉาก ${i + 1}`} className={field} rows={2} maxLength={VOICE_MAX} value={s.voice} onChange={(e) => setScene(i, { voice: e.target.value })} />
              {/* a device draws its own heading, never the screen words nor the premium card */}
              {isDevice ? (
                <p className="text-xs text-[var(--ct-mute)]">ฉากนี้ใช้หัวข้อของอุปกรณ์แทนคำบนจอ</p>
              ) : (
                <input
                  aria-label={`คำบนจอฉาก ${i + 1}`} className={field} maxLength={SCREEN_MAX} disabled={s.showFigure}
                  value={s.showFigure ? "การ์ดเบี้ยจริง (ระบบวาด)" : s.screen} onChange={(e) => setScene(i, { screen: e.target.value })}
                />
              )}
              {s.device && fields && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--ct-line)] p-2">
                  <p className="text-xs font-medium text-[var(--ct-accent)]">อุปกรณ์ที่ระบบวาด{k.kind !== "picture" ? `: ${k.name}` : ""} · แก้คำได้ ตัวเลขมาจากโจทย์หรือแผน</p>
                  {fields.words.map((w) => (
                    <label key={w.path.join(".")} className="block">
                      <span className="mb-0.5 block text-xs text-[var(--ct-mute)]">{w.label}</span>
                      <input
                        aria-label={`${w.label} ฉาก ${i + 1}`} className={field} maxLength={SCREEN_MAX} value={w.value}
                        onChange={(e) => setScene(i, { device: setDeviceWord(s.device!, w.path, e.target.value) })}
                      />
                    </label>
                  ))}
                  {fields.numbers.length > 0 && (
                    <div role="group" aria-label={`ตัวเลขของอุปกรณ์ ฉาก ${i + 1} (แก้ไม่ได้)`} className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-[var(--ct-mute)]">
                      {fields.numbers.map((n, j) => <span key={j}>{n.label}{n.value ? ` ${n.value}` : ""}</span>)}
                    </div>
                  )}
                </div>
              )}
              {k.kind === "broken" && (
                <p role="status" className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-xs text-[var(--ct-warn-ink)]">
                  อุปกรณ์นี้ใช้ไม่ได้: {k.reason}, ฉากนี้จะใช้ภาพ AI (คิดค่ารูป)
                </p>
              )}
              {!isDevice && (
                <input
                  aria-label={`ภาพฉาก ${i + 1}`} className={field} maxLength={PICTURE_MAX} value={s.picture} placeholder="คำบรรยายภาพที่อยากได้"
                  onChange={(e) => setScene(i, { picture: e.target.value })}
                />
              )}
              {missing === i && <p className="text-xs text-[var(--ct-alert)]">{needPictureWords(i + 1)}</p>}
              {asked[i] && !s.device && (
                <p role="status" className="text-xs text-[var(--ct-mute)]">อุปกรณ์มาจาก AI เท่านั้น กด “เขียนฉากนี้ใหม่” AI จะเลือกอุปกรณ์ให้ถ้าเข้ากับเรื่องของฉาก</p>
              )}
              {said[i] && <p role="alert" className="text-xs text-[var(--ct-alert)]">{said[i]}</p>}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-[var(--ct-mute)]">ตามด้วยการ์ดตัวแทน (ฉากสุดท้าย) อัตโนมัติ · ถ้าแก้บทแล้วใส่เลขที่ไม่อยู่ในโจทย์หรือตาราง ระบบจะบอกว่าฉากไหน และไม่เก็บเงิน</p>
    </div>
  );
}
