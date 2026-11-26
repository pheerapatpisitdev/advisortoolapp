"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deviceFields, editMotionAt, keptRewrite, missingPicture, motionAside, needPictureWords, pictureCount, rewritesLeft, sceneKind, scenePart, setDeviceWord,
  toAsset, toKindAt, toPicture, type ParkedMotion,
} from "@/lib/prompt-story/editor-state";
import {
  MOTION_KINDS, paints, REWRITES_DONE, REWRITES_PER_DRAFT, SCREEN_MAX, TITLE_MAX, type DeviceScene, type MotionKind, type MotionLayout, type PromptDesign,
  type PromptScene,
} from "@/lib/prompt-story/types";
import type { TaxSources } from "@/lib/prompt-story/check";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { rewritePromptScene } from "./actions";
import { chip, field, PICTURE_MAX } from "./editor-ui";
import { MotionFields } from "./MotionFields";
import { MotionPreview, PREVIEW_W } from "./MotionPreview";

/**
 * The script the AI wrote, every box editable (owner's mockup, 2026-10-16, state 2): per scene the
 * words said, the words on the screen and the picture wanted. A scene that shows the plan's real
 * premium has its screen words drawn by the system, so that box is shut.
 *
 * Health devices (2026-11-13, Task 10): a scene is "ภาพ AI" or a device the writer chose, its words
 * editable and its figures shown as they are; a device the server would drop says why and is priced as
 * a picture. ภาพ AI ↔ อุปกรณ์ switches a scene (a device only comes from the writer: "เขียนฉากนี้ใหม่",
 * free, REWRITES_PER_DRAFT a draft).
 *
 * ภาพจากคลัง (คลังแอนิเมชัน phase 3, spec 2026-11-14-library-uploads): a third choice, one of the library's
 * approved parts picked from a row of thumbnails, laid on the look's ground when the clip is made; no
 * picture words, not charged. A part the link named (?asset=) comes first; each scene names its own part.
 *
 * โมชันกราฟิก (owner, 2026-11-26, mockup ข round 2's หน้าแก้บท): with `design` the choice is แบบฉาก, the six layouts then
 * อุปกรณ์ and ภาพจากคลัง; the boxes under it follow the layout (MotionFields), and a small preview of the scene plays
 * beside them (MotionPreview, free, no voice), under them on a phone. A layout switched away from is parked and comes
 * back as it was left. Without `design` the editor is exactly what it was.
 */

const VOICE_MAX = 400;
const KIND_NAME = Object.fromEntries(MOTION_KINDS.map((k) => [k.id, k.name])) as Record<MotionKind, string>;
const CARD = "grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3";
/** โมชันกราฟิก: the preview a third column, or under the words on a phone */
const MOTION_CARD = `${CARD} sm:grid-cols-[24px_minmax(0,1fr)_auto]`;

/** a failing device's scene as the server keeps it (the device dropped), for its preview */
function withoutDevice(s: PromptScene): PromptScene {
  const { device: _gone, ...rest } = s;
  void _gone;
  return rest;
}

/** what a scene becomes when its device fails: the words of the warning */
function fallbackWords(s: PromptScene, design?: PromptDesign): string {
  if (!design || (!s.motion && !s.showFigure)) return "ฉากนี้จะใช้ภาพ AI (คิดค่ารูป)";
  if (s.showFigure) return "ฉากนี้จะใช้การ์ดเบี้ยจริง (ระบบวาด ไม่คิดค่ารูป)";
  const kept = withoutDevice(s);
  return `ฉากนี้จะใช้แบบ${KIND_NAME[s.motion!.kind]} (${paints(kept, design) ? "คิดค่ารูป" : "ไม่คิดค่ารูป"})`;
}

export interface Draft {
  id: string;
  title: string;
  caption: string;
  scenes: PromptScene[];
  /** เขียนฉากนี้ใหม่ left on this draft; none = all of them */
  left?: number;
  /** a device the agent turned into ภาพ AI, by scene (from 0): อุปกรณ์ brings it back */
  parked?: Record<number, DeviceScene>;
  /** โมชันกราฟิก: the layouts a scene was switched away from, by scene and kind: that แบบฉาก brings each back */
  parkedMotion?: ParkedMotion;
}

/** a library part the agent may pick: an approved upload's id and name */
export interface LibraryPart { id: string; name: string }

export function ScriptEditor({ draft, notes, onChange, forDevice, tax, assets = [], startAsset, design, size = "portrait" }: {
  draft: Draft;
  /** scenes (from 0) the writer had to make plain: the agent is told */
  notes: number[];
  onChange: (next: Draft) => void;
  /** the figures a device may show: deviceAllowed of the brief and plan the script was written from */
  forDevice: Set<number>;
  /** a taxback's bracket and premium: briefTax of the brief the script was written from (the page always gives it) */
  tax?: TaxSources;
  /** the library's approved parts (the page's list); none when the library cannot be read */
  assets?: LibraryPart[];
  /** the part a library link named (?asset=): first in the row when it is in the list */
  startAsset?: string;
  /** หน้าตาคลิป: "motion" is โมชันกราฟิก, a layout a scene; none is หน้าตาเดิม */
  design?: PromptDesign;
  /** the clip's shape, for the previews */
  size?: VideoSize;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [said, setSaid] = useState<Record<number, string>>({});
  /** scenes whose อุปกรณ์ was pressed with no device to bring back: told to ask the writer */
  const [asked, setAsked] = useState<Record<number, boolean>>({});
  /** scenes whose ภาพจากคลัง was pressed with no part in the library: told where to upload */
  const [noParts, setNoParts] = useState<Record<number, boolean>>({});
  /** โมชันกราฟิก: scenes whose แบบฉาก could not be chosen (ตัวเลขใหญ่ with no figure), and why */
  const [refused, setRefused] = useState<Record<number, string>>({});
  // the draft as it is now, for an answer that comes back after the agent kept typing
  const latest = useRef(draft);
  useEffect(() => { latest.current = draft; });

  const left = draft.left ?? REWRITES_PER_DRAFT;
  const kinds = draft.scenes.map((s) => sceneKind(s, forDevice, tax));
  const devices = kinds.filter((k) => k.kind === "device").length;
  const fromLibrary = kinds.filter((k) => k.kind === "asset").length;
  const linked = assets.find((p) => p.id === startAsset);
  const parts = linked ? [linked, ...assets.filter((p) => p !== linked)] : assets;
  const missing = missingPicture(draft.scenes, forDevice, tax, design);
  const motion = design === "motion";
  // โมชันกราฟิก: the scenes the painter draws, as the clip charges them; the rest but the parts the system draws
  const painted = motion ? pictureCount(draft.scenes, forDevice, tax, design) : 0;
  // the figures ตัวเลขใหญ่ may show: the very ones checkMotion takes
  const numbers = useMemo(() => [...forDevice], [forDevice]);

  const setScene = (i: number, patch: Partial<PromptScene>) =>
    onChange({ ...draft, scenes: draft.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  function toPictureAt(i: number) {
    const s = draft.scenes[i];
    if (!s.device && !s.asset) return;
    onChange({ ...draft, scenes: draft.scenes.map((x, j) => (j === i ? toPicture(x) : x)), ...(s.device ? { parked: { ...draft.parked, [i]: s.device } } : {}) });
  }
  /** ภาพจากคลัง: the part pressed, else the one in use, else the first in the row; a device is parked for อุปกรณ์ */
  function toAssetAt(i: number, id?: string) {
    const s = draft.scenes[i];
    const pick = id ?? (s.asset && assets.some((p) => p.id === s.asset) ? s.asset : parts[0]?.id);
    if (!pick) {
      setNoParts((m) => ({ ...m, [i]: true }));
      return;
    }
    if (s.asset === pick && !s.device) return;
    // a layout gives way to the part, kept for its แบบฉาก
    const base = motion ? motionAside(draft, i) : draft;
    onChange({ ...base, scenes: base.scenes.map((x, j) => (j === i ? toAsset(x, pick) : x)), ...(s.device ? { parked: { ...base.parked, [i]: s.device } } : {}) });
    setRefused((m) => ({ ...m, [i]: "" }));
  }
  function toDeviceAt(i: number) {
    const kept = draft.parked?.[i];
    if (draft.scenes[i].device) return;
    if (!kept) {
      setAsked((a) => ({ ...a, [i]: true }));
      return;
    }
    // a layout gives way to the device, kept for its แบบฉาก
    const base = motion ? motionAside(draft, i) : draft;
    const parked = { ...base.parked };
    delete parked[i];
    // the device in place of a part, if one was chosen meanwhile
    const back = (x: PromptScene): PromptScene => {
      const { asset: _part, ...rest } = x;
      void _part;
      return { ...rest, device: kept };
    };
    onChange({ ...base, scenes: base.scenes.map((x, j) => (j === i ? back(x) : x)), parked });
    setRefused((m) => ({ ...m, [i]: "" }));
  }
  /** แบบฉาก pressed: the layout parked for it, else one begun from the scene's words; ตัวเลขใหญ่ with no figure says why */
  function pickKind(i: number, kind: MotionKind) {
    const r = toKindAt(draft, i, kind, numbers);
    if (typeof r === "string") {
      setRefused((m) => ({ ...m, [i]: r }));
      return;
    }
    setRefused((m) => ({ ...m, [i]: "" }));
    if (r !== draft) onChange(r);
  }
  const editLayout = (i: number, m: MotionLayout) => onChange(editMotionAt(draft, i, m));

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
        // the layouts parked were for the words the writer has replaced
        const shelf = now.parkedMotion ? { ...now.parkedMotion } : undefined;
        if (shelf) delete shelf[i];
        onChange({ ...now, scenes: now.scenes.map((x, j) => (j === i ? keptRewrite(x, r.scene) : x)), left: nextLeft, parked, ...(shelf ? { parkedMotion: shelf } : {}) });
        setAsked((a) => ({ ...a, [i]: false }));
        setRefused((m) => ({ ...m, [i]: "" }));
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
          {motion ? (
            `ภาพ AI ${painted} ฉาก · แบบฉากที่ระบบวาด ${draft.scenes.length - painted - fromLibrary} ฉาก (ไม่คิดค่ารูป)`
          ) : (
            <>ภาพ AI {draft.scenes.length - devices - fromLibrary} ฉาก{devices > 0 && ` · อุปกรณ์ ${devices} ฉาก (ระบบวาด ไม่คิดค่ารูป)`}</>
          )}
          {fromLibrary > 0 && ` · ภาพจากคลัง ${fromLibrary} ฉาก`}
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
        const isAsset = k.kind === "asset";
        const fields = s.device ? deviceFields(s.device) : null;
        const chosen = isAsset ? scenePart(s, assets) : undefined;
        // โมชันกราฟิก: the scene's layout, unless a device that passes or a part stands in its place, or the premium card
        // (it draws the figure, and the server drops a layout under it: its chips are shut)
        const card = motion && Boolean(s.showFigure);
        const laid = motion && !isDevice && !isAsset && !card ? s.motion : undefined;
        return (
          <div key={i} className={motion ? MOTION_CARD : CARD}>
            <b className="text-[var(--ct-accent)]">{i + 1}</b>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {motion ? (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`แบบของฉาก ${i + 1}`}>
                    {MOTION_KINDS.map((x) => (
                      <button key={x.id} type="button" role="radio" aria-checked={laid?.kind === x.id} disabled={card} className={`${chip(laid?.kind === x.id)} disabled:opacity-50`} onClick={() => pickKind(i, x.id)}>{x.name}</button>
                    ))}
                    <button type="button" role="radio" aria-checked={isDevice} className={chip(isDevice)} onClick={() => toDeviceAt(i)}>
                      {isDevice ? k.name : "อุปกรณ์"}
                    </button>
                    <button type="button" role="radio" aria-checked={isAsset} className={chip(isAsset)} onClick={() => toAssetAt(i)}>ภาพจากคลัง</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`ภาพของฉาก ${i + 1}`}>
                    <button type="button" role="radio" aria-checked={!isDevice && !isAsset} className={chip(!isDevice && !isAsset)} onClick={() => toPictureAt(i)}>ภาพ AI</button>
                    <button type="button" role="radio" aria-checked={isDevice} className={chip(isDevice)} onClick={() => toDeviceAt(i)}>
                      {isDevice ? k.name : "อุปกรณ์"}
                    </button>
                    <button type="button" role="radio" aria-checked={isAsset} className={chip(isAsset)} onClick={() => toAssetAt(i)}>ภาพจากคลัง</button>
                  </div>
                )}
                <button
                  type="button" onClick={() => rewrite(i)} disabled={busy !== null || left <= 0} aria-label={`เขียนฉาก ${i + 1} ใหม่ (เหลือ ${left})`}
                  className="ml-auto min-h-11 rounded-lg border border-[var(--ct-accent)] px-3 text-sm text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50"
                >
                  {busy === i ? "กำลังเขียน…" : left <= 0 ? "เขียนฉากใหม่ครบแล้ว" : `เขียนฉากนี้ใหม่ (เหลือ ${left})`}
                </button>
              </div>
              {refused[i] && <p role="status" className="text-xs text-[var(--ct-mute)]">{refused[i]}</p>}
              <textarea aria-label={`บทพูดฉาก ${i + 1}`} className={field} rows={2} maxLength={VOICE_MAX} value={s.voice} onChange={(e) => setScene(i, { voice: e.target.value })} />
              {/* a device draws its own heading, never the screen words nor the premium card */}
              {isDevice ? (
                <p className="text-xs text-[var(--ct-mute)]">ฉากนี้ใช้หัวข้อของอุปกรณ์แทนคำบนจอ</p>
              ) : laid ? (
                <MotionFields scene={{ ...s, motion: laid }} n={i + 1} onEdit={(m) => editLayout(i, m)} onPicture={(picture) => setScene(i, { picture })} />
              ) : motion && isAsset ? null : (
                <input
                  aria-label={`คำบนจอฉาก ${i + 1}`} className={field} maxLength={SCREEN_MAX} disabled={s.showFigure}
                  value={s.showFigure ? "การ์ดเบี้ยจริง (ระบบวาด)" : s.screen} onChange={(e) => setScene(i, { screen: e.target.value })}
                />
              )}
              {s.device && fields && !isAsset && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--ct-line)] p-2">
                  <p className="text-xs font-medium text-[var(--ct-accent)]">อุปกรณ์ที่ระบบวาด{k.kind === "device" || k.kind === "broken" ? `: ${k.name}` : ""} · แก้คำได้ ตัวเลขมาจากโจทย์หรือแผน</p>
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
                  อุปกรณ์นี้ใช้ไม่ได้: {k.reason}, {fallbackWords(s, design)}
                </p>
              )}
              {(isAsset || (noParts[i] && !assets.length)) && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--ct-line)] p-2">
                  {assets.length === 0 ? (
                    <p role="status" className="text-xs text-[var(--ct-mute)]">ยังไม่มีภาพในคลัง อัปโหลดได้ที่เมนูคลังแอนิเมชัน</p>
                  ) : (
                    <>
                      {chosen && <p className="text-xs font-medium text-[var(--ct-accent)]">ภาพที่เลือกจากคลัง: {chosen.name}</p>}
                      <div role="radiogroup" aria-label={`ภาพจากคลังของฉาก ${i + 1}`} className="flex gap-2 overflow-x-auto pb-1">
                        {parts.map((p) => {
                          const on = isAsset && k.id === p.id;
                          return (
                            <button
                              key={p.id} type="button" role="radio" aria-checked={on} aria-label={p.name} onClick={() => toAssetAt(i, p.id)}
                              className={`size-16 min-h-11 shrink-0 overflow-hidden rounded-lg border-2 bg-[var(--ct-ground)] p-1 ${on ? "border-[var(--ct-solid)]" : "border-[var(--ct-line)] hover:border-[var(--ct-accent)]"}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- the upload route's own picture, behind the viewer's sign-in */}
                              <img src={`/api/library-upload?id=${p.id}&n=0`} alt="" loading="lazy" className="h-full w-full object-contain" />
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-[var(--ct-mute)]">ภาพวางกลางฉากบนพื้นของหน้าตาคลิป ฉากนี้ไม่คิดค่ารูป</p>
                    </>
                  )}
                </div>
              )}
              {/* โมชันกราฟิก: a layout asks its own picture words, the premium card none */}
              {!isDevice && !isAsset && !(motion && (laid || s.showFigure)) && (
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
            {motion && (
              <div className="col-start-2 space-y-1 sm:col-start-3 sm:row-start-1" style={{ width: PREVIEW_W[size] }}>
                <MotionPreview scene={k.kind === "broken" ? withoutDevice(s) : s} size={size} label={`ภาพตัวอย่างฉาก ${i + 1}`} />
                <span className="block text-xs text-[var(--ct-mute)]">ตัวอย่างฉาก</span>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-[var(--ct-mute)]">ตามด้วยการ์ดตัวแทน (ฉากสุดท้าย) อัตโนมัติ · ถ้าแก้บทแล้วใส่เลขที่ไม่อยู่ในโจทย์หรือตาราง ระบบจะบอกว่าฉากไหน และไม่เก็บเงิน</p>
    </div>
  );
}
