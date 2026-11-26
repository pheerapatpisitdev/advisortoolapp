import type { ReactNode } from "react";
import { addLine, dropLine, LINES_MAX, MOTION_GAP, motionGaps, starLine } from "@/lib/prompt-story/editor-state";
import { MOTION_ICONS, MOTION_KINDS, MOTION_LIMITS as L, paints, type MotionIcon, type MotionLayout, type MotionSide, type PromptScene } from "@/lib/prompt-story/types";
import { chip, field, PICTURE_MAX } from "./editor-ui";

/**
 * A โมชันกราฟิก scene's words, as its layout holds them (owner, 2026-11-26, mockup ข round 2's หน้าแก้บท): every box
 * at the layout's limit (MOTION_LIMITS), the big number shown and never typed (it is a figure of the brief or the
 * plan), a headline's lines each with its ★ คำเน้น, and the picture words only where the layout paints. The server
 * checks it all again when the clip is made (checkMotion).
 */

/** the six icons as the agent reads them */
const ICON_NAMES: Record<MotionIcon, string> = { fever: "ปรอท", hospital: "โรงพยาบาล", money: "เงิน", heart: "หัวใจ", shield: "โล่", home: "บ้าน" };
const KIND_NAME = Object.fromEntries(MOTION_KINDS.map((k) => [k.id, k.name])) as Record<MotionLayout["kind"], string>;

const label = "mb-0.5 block text-xs text-[var(--ct-mute)]";
const grid2 = "grid grid-cols-1 gap-2 sm:grid-cols-2";
const star = (on: boolean) =>
  `min-h-11 w-24 shrink-0 whitespace-nowrap rounded-full border px-2 text-xs ${on ? "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] font-semibold text-[var(--ct-warn-ink)]" : "border-[var(--ct-hair)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const small = "min-h-11 shrink-0 rounded-lg border border-[var(--ct-hair)] px-3 text-sm text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]";

export function MotionFields({ scene, n, onEdit, onPicture }: {
  scene: PromptScene & { motion: MotionLayout };
  /** the scene's number, from 1 */
  n: number;
  /** the layout with one field changed */
  onEdit: (m: MotionLayout) => void;
  onPicture: (words: string) => void;
}) {
  const m = scene.motion;
  const at = (what: string) => `${what} ฉาก ${n}`;
  const box = (name: string, value: string, max: number, set: (v: string) => void, aria = at(name)) => (
    <label className="block min-w-0">
      <span className={label}>{name}</span>
      <input aria-label={aria} className={field} maxLength={max} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
  const picture = (name: string) => (
    <label className="block">
      <span className={label}>{name}</span>
      <input
        aria-label={at(name)} className={field} maxLength={PICTURE_MAX} value={scene.picture} placeholder="คำบรรยายภาพที่อยากได้"
        onChange={(e) => onPicture(e.target.value)}
      />
    </label>
  );
  const cost = paints(scene, "motion") ? "คิดค่ารูป 1 ภาพ" : "ระบบวาด ไม่คิดค่ารูป";
  const title = m.kind === "check" && m.photo ? "เช็กลิสต์ · ภาพวงกลม: มี (คิดค่ารูป 1 ภาพ)" : `${KIND_NAME[m.kind]} · ${cost}`;

  let body: ReactNode;
  switch (m.kind) {
    case "hook":
    case "full": {
      const lined = m;
      body = (
        <>
          {lined.lines.map((line, j) => (
            <div key={j} className="flex items-center gap-2">
              <input
                aria-label={at(`บรรทัดที่ ${j + 1}`)} className={field} maxLength={L.line} value={line}
                onChange={(e) => onEdit({ ...lined, lines: lined.lines.map((x, k) => (k === j ? e.target.value : x)) })}
              />
              <button type="button" aria-pressed={lined.key === j} aria-label={at(`คำเน้น บรรทัดที่ ${j + 1}`)} className={star(lined.key === j)} onClick={() => onEdit(starLine(lined, j))}>
                {lined.key === j ? "★ คำเน้น" : "เน้น"}
              </button>
              {lined.lines.length > 1 && (
                <button type="button" aria-label={at(`ลบบรรทัดที่ ${j + 1}`)} className={small} onClick={() => onEdit(dropLine(lined, j))}>ลบ</button>
              )}
            </div>
          ))}
          {lined.lines.length < LINES_MAX[lined.kind] && (
            <button type="button" className={`${small} text-[var(--ct-accent)]`} onClick={() => onEdit(addLine(lined))}>+ เพิ่มบรรทัด</button>
          )}
          {lined.kind === "hook" ? (
            <label className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-[var(--ct-mute)]">ไอคอน</span>
              <select aria-label={at("ไอคอน")} className={field} value={lined.icon} onChange={(e) => onEdit({ ...lined, icon: e.target.value as MotionIcon })}>
                {MOTION_ICONS.map((id) => <option key={id} value={id}>{ICON_NAMES[id]}</option>)}
              </select>
            </label>
          ) : picture("คำบรรยายภาพ")}
        </>
      );
      break;
    }
    case "card":
      body = (
        <>
          {box("ป้ายบน", m.tag, L.tag, (tag) => onEdit({ ...m, tag }))}
          <div className={grid2}>
            {box("ป้ายที่ 1", m.chips[0], L.chip, (c) => onEdit({ ...m, chips: [c, m.chips[1]] }))}
            {box("ป้ายที่ 2", m.chips[1], L.chip, (c) => onEdit({ ...m, chips: [m.chips[0], c] }))}
          </div>
          {picture("คำบรรยายภาพ")}
        </>
      );
      break;
    case "number":
      body = (
        <>
          <div className={grid2}>
            <label className="block min-w-0">
              <span className={label}>ตัวเลข (มาจากโจทย์ แก้ไม่ได้)</span>
              <input aria-label={at("ตัวเลข (มาจากโจทย์ แก้ไม่ได้)")} className={`${field} bg-[var(--ct-ground)] tabular-nums text-[var(--ct-mute)]`} readOnly value={m.value.toLocaleString("en-US")} />
            </label>
            {box("หน่วย", m.unit, L.unit, (unit) => onEdit({ ...m, unit }))}
          </div>
          <div className={grid2}>
            {box("ป้ายบน", m.tag, L.tag, (tag) => onEdit({ ...m, tag }))}
            {box("หัวใบเสร็จ", m.bill, L.bill, (bill) => onEdit({ ...m, bill }))}
          </div>
        </>
      );
      break;
    case "compare": {
      const side = (which: "bad" | "good", head: string, text: string) => {
        const s: MotionSide = m[which];
        const put = (next: MotionSide) => onEdit(which === "bad" ? { ...m, bad: next } : { ...m, good: next });
        return (
          <div className="min-w-0 space-y-1.5">
            {box(head, s.head, L.head, (h) => put({ ...s, head: h }))}
            <div className="space-y-1.5">
              <span className={label}>{text}</span>
              {s.lines.map((line, j) => (
                <input
                  key={j} aria-label={at(`${text} บรรทัด ${j + 1}`)} className={field} maxLength={L.side} value={line}
                  onChange={(e) => put({ ...s, lines: j === 0 ? [e.target.value, s.lines[1]] : [s.lines[0], e.target.value] })}
                />
              ))}
            </div>
          </div>
        );
      };
      body = (
        <>
          {box("หัวข้อ", m.title, L.title, (title) => onEdit({ ...m, title }))}
          <div className={grid2}>
            {side("bad", "ฝั่งแรก (✕)", "ข้อความฝั่งแรก")}
            {side("good", "ฝั่งสอง (✓)", "ข้อความฝั่งสอง")}
          </div>
        </>
      );
      break;
    }
    case "check":
      body = (
        <>
          <div className={grid2}>
            {box("หัวข้อบรรทัด 1", m.lines[0], L.line, (x) => onEdit({ ...m, lines: [x, m.lines[1]] }))}
            {box("หัวข้อบรรทัด 2 (คำเน้น)", m.lines[1], L.line, (x) => onEdit({ ...m, lines: [m.lines[0], x] }))}
          </div>
          {m.ticks.map((tick, j) => (
            <div key={j}>{box(`ข้อ ${j + 1}`, tick, L.tick, (x) => onEdit({ ...m, ticks: m.ticks.map((y, k) => (k === j ? x : y)) as typeof m.ticks }))}</div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--ct-mute)]">ภาพวงกลม</span>
            <div role="radiogroup" aria-label={at("ภาพวงกลม")} className="flex gap-2">
              <button type="button" role="radio" aria-checked={m.photo} className={chip(m.photo)} onClick={() => { if (!m.photo) onEdit({ ...m, photo: true }); }}>มี</button>
              <button type="button" role="radio" aria-checked={!m.photo} className={chip(!m.photo)} onClick={() => { if (m.photo) onEdit({ ...m, photo: false }); }}>ไม่มี</button>
            </div>
          </div>
          {m.photo && picture("คำบรรยายภาพวงกลม")}
        </>
      );
      break;
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--ct-line)] p-2">
      <p className="text-xs font-medium text-[var(--ct-accent)]">{title}</p>
      {body}
      {motionGaps(m) > 0 && <p className="text-xs text-[var(--ct-alert)]">{MOTION_GAP}</p>}
    </div>
  );
}
