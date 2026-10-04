"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/content/poster";
import { writeCount } from "@/lib/ads/ad-card";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "../ThemeSwatches";
import { errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { updateAdCampaign } from "./actions";
import type { Room } from "./AdEditor";
import { upTo, type AdRules } from "./rules";
import { chip, field, plain, solid } from "./styles";

/**
 * A campaign's settings, on the left of its room and folded away on a phone: the plan (set
 * when it was made, shown only), its name, the grid of selling angles × tones, the posters'
 * colour, and what the owner wants stressed, which the writer reads as the brief. Under them,
 * the button that writes the next ads. Settings changed and not saved are saved first, since
 * the writer reads the campaign, not this form.
 */

const HINT_MAX = 120;

export function CampaignSettings({ campaign, productName, rules, writing, onWrite }: {
  campaign: Room["campaign"];
  /** the plan's name, shown and not editable */
  productName: string;
  rules: AdRules;
  /** a round is being written: the button stays shut until it is back */
  writing: boolean;
  onWrite: (count: number) => void;
}) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState(campaign.name ?? "");
  const [angles, setAngles] = useState(campaign.angles);
  const [tones, setTones] = useState(campaign.tones);
  const [theme, setTheme] = useState<ThemeChoice>((campaign.theme as Theme | null) ?? AUTO_THEME);
  const [hint, setHint] = useState(campaign.hint ?? "");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<NoteState>(null);

  const themeValue = theme === AUTO_THEME ? null : theme;
  const dirty = (name.trim() || null) !== campaign.name || angles !== campaign.angles || tones !== campaign.tones
    || themeValue !== campaign.theme || (hint.trim() || null) !== campaign.hint;
  const count = writeCount(angles, tones);

  async function persist(): Promise<boolean> {
    if (!dirty) return true;
    setSaving(true);
    setNote(null);
    try {
      const res = await updateAdCampaign(campaign.id, { name, angles, tones, theme: themeValue, hint });
      if (!res.ok) { setNote(errorNote(res.error)); return false; }
      router.refresh();
      return true;
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่ได้บันทึกการตั้งค่า ลองใหม่อีกครั้ง"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (await persist()) setNote(okNote("บันทึกการตั้งค่าแล้ว"));
  }

  async function write() {
    if (writing || saving) return;
    if (!(await persist())) return;
    onWrite(count);
  }

  return (
    <section aria-label="ตั้งค่าแคมเปญ" className="rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
      <details open className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
          ตั้งค่าแคมเปญ
          <span aria-hidden className="text-[var(--ct-mute)] transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-4 border-t border-[var(--ct-hair)] p-4">
          <fieldset disabled={saving || writing} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <legend className="sr-only">ตั้งค่าแคมเปญ</legend>
            <div className="text-sm">
              <span className="block text-xs text-[var(--ct-mute)]">แบบประกัน (ตั้งตอนสร้าง แก้ไม่ได้)</span>
              <span className="font-medium">{productName}</span>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium">ชื่อแคมเปญ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={field} />
            </label>
            <div role="group" aria-labelledby={`${id}-angles`}>
              <span id={`${id}-angles`} className="mb-1.5 block text-sm font-medium">มุมขาย</span>
              <div className="flex flex-wrap gap-2">
                {upTo(rules.maxAngles).map((n) => (
                  <button key={n} type="button" aria-pressed={angles === n} onClick={() => setAngles(n)} className={chip(angles === n)}>{n}</button>
                ))}
              </div>
            </div>
            <div role="group" aria-labelledby={`${id}-tones`}>
              <span id={`${id}-tones`} className="mb-1.5 block text-sm font-medium">น้ำเสียงต่อมุม</span>
              <div className="flex flex-wrap gap-2">
                {upTo(rules.maxTones).map((n) => (
                  <button key={n} type="button" aria-pressed={tones === n} onClick={() => setTones(n)} className={chip(tones === n)}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
              <ThemeSwatches<ThemeChoice> value={theme} onChange={setTheme} allowAuto />
            </div>
            <label className="block space-y-1">
              <span className="flex justify-between text-sm font-medium">
                <span>สิ่งที่อยากเน้น <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
                <span className="text-xs font-normal text-[var(--ct-mute)]">{[...hint].length}/{HINT_MAX}</span>
              </span>
              <textarea
                value={hint} onChange={(e) => setHint(e.target.value)} maxLength={HINT_MAX} rows={3}
                placeholder="เช่น เน้นคนทำงานอายุ 30 ที่ยังไม่มีประกันสุขภาพ"
                className={`${field} leading-relaxed`}
              />
            </label>
          </fieldset>
          {dirty && (
            <button type="button" onClick={save} disabled={saving || writing} className={`${plain} w-full`}>
              {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
            </button>
          )}
          <Note note={note} />
        </div>
      </details>
      {/* outside the fold: folding the settings away on a phone keeps the button */}
      <div className="sticky bottom-0 rounded-b-2xl border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
        <button type="button" onClick={write} disabled={writing || saving || !campaign.pageConnected} className={`${solid} w-full`}>
          {writing ? "กำลังเขียนแอด…" : `เขียนแอดเพิ่ม ${count} แบบ`}
        </button>
        {!campaign.pageConnected && <p role="note" className="mt-1.5 text-xs font-medium text-[var(--ct-alert)]">เพจนี้ไม่ได้เชื่อมกับระบบแล้ว</p>}
        <p className="mt-1.5 text-xs text-[var(--ct-mute)]">{angles} มุมขาย × {tones} น้ำเสียง · ราว 20–40 วินาที</p>
      </div>
    </section>
  );
}
