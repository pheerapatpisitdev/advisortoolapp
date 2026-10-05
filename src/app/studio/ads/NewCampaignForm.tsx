"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/content/poster";
import type { PersonOption } from "../PersonPicker";
import { AUTO_THEME } from "../ThemeSwatches";
import { errorNote, Note, type NoteState } from "../ui/editor-fields";
import { createAdCampaign } from "./actions";
import { PictureFields, type PicturePicks } from "./PictureFields";
import { field, solid } from "./styles";

/**
 * A new campaign on one page of Ads Studio's tools column (owner, 2026-10-05): the plan, and if the
 * owner likes a name, what to stress, the brand's voice and ภาพและโมเดล (PictureFields), then
 * สร้างแคมเปญ. Made, Ads Studio opens its room; no ad is written until the owner presses there.
 * Folded away on a phone like the settings it stands in for; ยกเลิก goes back to the campaign
 * that was open. In the create drawer (2026-10-05) the drawer carries the title and ✕, and is told
 * while the campaign is being made (`onCreating`) so it stays open.
 */

const NAME_MAX = 60;
const TEXT_MAX = 120;

function Counted({ label, value, onChange, max, rows, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between gap-2 text-sm font-medium">
        <span>{label} <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
        <span className="text-xs font-normal tabular-nums text-[var(--ct-mute)]">{[...value].length}/{max}</span>
      </span>
      {rows
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} rows={rows} placeholder={placeholder} className={`${field} leading-relaxed`} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} placeholder={placeholder} className={field} />}
    </label>
  );
}

export function NewCampaignForm({ pageId, products, people, folded, onCancel, heading = true, onCreating }: {
  pageId: string;
  products: { href: string; name: string }[];
  /** the people library, for ใส่บุคคลในภาพ */
  people: PersonOption[];
  /** a phone with the tools folded */
  folded: boolean;
  /** back to the campaign that was open; null when the Page has none to go back to */
  onCancel: (() => void) | null;
  /** its own title line (แคมเปญใหม่ · ยกเลิก); off in the drawer, which has its own */
  heading?: boolean;
  /** told when making the campaign starts and stops */
  onCreating?: (on: boolean) => void;
}) {
  const router = useRouter();
  const [planHref, setPlanHref] = useState("");
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [voice, setVoice] = useState("");
  const [picks, setPicks] = useState<PicturePicks>({ writer: null, painter: null, theme: AUTO_THEME, person: null, brief: "" });
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<NoteState>(null);
  useEffect(() => { onCreating?.(creating); }, [creating, onCreating]);

  async function create() {
    if (!planHref || creating) return;
    setCreating(true);
    setNote(null);
    try {
      const res = await createAdCampaign({
        pageId, planHref, name: name.trim() || null, hint: focus, brandVoice: voice,
        theme: picks.theme === AUTO_THEME ? null : (picks.theme as Theme),
        writer: picks.writer, painter: picks.painter, person: picks.person, pictureBrief: picks.brief,
      });
      if (!res.ok) { setNote(errorNote(res.error)); setCreating(false); return; }
      // creating stays on until the room opens: a second press would make a second campaign
      router.push(`/studio/ads?campaign=${encodeURIComponent(res.id)}`);
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง — ถ้าแคมเปญขึ้นในรายการแล้ว ไม่ต้องสร้างซ้ำ"));
      setCreating(false);
    }
  }

  return (
    <div className={`space-y-4 border-t border-[var(--ct-hair)] p-4 ${folded ? "hidden lg:block" : ""}`}>
      {heading && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">แคมเปญใหม่</h3>
          {onCancel && <button type="button" onClick={onCancel} disabled={creating} className="min-h-11 rounded-lg px-2 text-sm text-[var(--ct-mute)] hover:bg-[var(--ct-ground)] disabled:opacity-50">ยกเลิก</button>}
        </div>
      )}
      <fieldset disabled={creating} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <legend className="sr-only">ข้อมูลแคมเปญ</legend>
        <label className="block space-y-1">
          <span className="text-sm font-medium">แบบประกัน</span>
          <select value={planHref} onChange={(e) => setPlanHref(e.target.value)} className={field}>
            <option value="">เลือกแบบประกัน…</option>
            {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
          </select>
          <span className="block text-xs text-[var(--ct-mute)]">ข้อมูลสินค้าและตัวเลขมาจากแบบประกันในระบบเสมอ</span>
        </label>
        <Counted label="ชื่อแคมเปญ" value={name} onChange={setName} max={NAME_MAX} placeholder="ไม่ใส่ ใช้ชื่อแบบประกันแทน" />
        <Counted label="สิ่งที่อยากเน้น" value={focus} onChange={setFocus} max={TEXT_MAX} rows={2} placeholder="เช่น เน้นคนทำงานอายุ 30 ที่ยังไม่มีประกันสุขภาพ" />
        <Counted label="น้ำเสียงแบรนด์" value={voice} onChange={setVoice} max={TEXT_MAX} rows={2} placeholder="เช่น อบอุ่น เป็นกันเอง ไม่ขายของแรง" />
        <PictureFields
          value={picks} onChange={(next) => setPicks((p) => ({ ...p, ...next }))}
          people={people} back={`/studio/ads?page=${encodeURIComponent(pageId)}&create=campaign`}
        />
      </fieldset>
      <button type="button" onClick={create} disabled={!planHref || creating} className={`${solid} w-full`}>
        {creating ? "กำลังสร้าง…" : "สร้างแคมเปญ"}
      </button>
      <p className="text-xs text-[var(--ct-mute)]">ยังไม่เขียนแอดและยังไม่เสียค่าใช้จ่าย — สร้างแล้วเลือกมุม คนอ่าน และอายุ แล้วกดสร้างโฆษณา</p>
      <Note note={note} />
    </div>
  );
}
