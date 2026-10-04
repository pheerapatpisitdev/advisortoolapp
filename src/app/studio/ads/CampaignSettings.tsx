"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/content/poster";
import { comboLine, fromEdit, sameDimensions, shortOf, toEdit, type EditDims } from "@/lib/ads/dimension-edit";
import { roundCost, WRITE_COUNTS, type WriteCount } from "@/lib/ads/room-view";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "../ThemeSwatches";
import { errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { analyzeCampaign, updateAdCampaign } from "./actions";
import type { Room } from "./AdEditor";
import { DimensionsEditor } from "./DimensionsEditor";
import { chip, field, plain, solid } from "./styles";

/**
 * A campaign's settings, on the left of its room and folded away on a phone: the plan (set
 * when it was made, shown only), its name, what to stress, the brand's voice, the posters'
 * colour, and the four dimensions — which steer only the ads still to be written. Under them,
 * the button that writes the next 1, 2 or 4 ads from the queue; it says so when the queue is
 * walked to its end. A campaign made before dimensions offers the AI's analysis instead.
 * Settings changed and not saved are saved first, since the writer reads the campaign, not
 * this form.
 */

const NAME_MAX = 60;
const TEXT_MAX = 120;

/**
 * For a campaign made before dimensions: the AI proposes them from its plan, focus and voice.
 * The panel is drawn afresh once they are saved, so how it went is told to the room (`onDone`).
 */
function Analyse({ campaignId, onDone }: { campaignId: string; onDone: (fallback: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<NoteState>(null);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!busy) { setSeconds(0); return; }
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [busy]);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await analyzeCampaign(campaignId);
      if (!res.ok) { setNote(errorNote(res.error)); return; }
      onDone(res.fallback);
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุดระหว่างรอ AI ลองใหม่อีกครั้ง"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">แคมเปญนี้สร้างก่อนมีมิติ — ให้ AI เสนอ ฮุก กลุ่มคน มุมขาย และสไตล์ภาพก่อน แล้วจึงสร้างแอดจากคิวได้</p>
      <button type="button" onClick={run} disabled={busy} className={`${solid} w-full`}>
        {busy ? `กำลังวิเคราะห์… ${seconds} วินาที` : "ให้ AI วิเคราะห์มิติ"}
      </button>
      <p className="text-xs text-[var(--ct-mute)]">ราว 10–20 วินาที ค่าใช้จ่ายไม่ถึง 1 บาท</p>
      <Note note={note} />
    </div>
  );
}

export function CampaignSettings({ campaign, productName, queue, writing, onWrite, onAnalysed }: {
  campaign: Room["campaign"];
  /** the plan's name, shown and not editable */
  productName: string;
  queue: Room["queue"];
  /** a round is being written: the button stays shut until it is back */
  writing: boolean;
  onWrite: (count: WriteCount) => void;
  /** the AI's dimensions were saved on a campaign that had none; `fallback` when they are the starting set */
  onAnalysed: (fallback: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name ?? "");
  const [hint, setHint] = useState(campaign.hint ?? "");
  const [voice, setVoice] = useState(campaign.brandVoice ?? "");
  const [theme, setTheme] = useState<ThemeChoice>((campaign.theme as Theme | null) ?? AUTO_THEME);
  // the room remounts this panel when a campaign gains its dimensions, so they start from the saved ones
  const [dims, setDims] = useState<EditDims | null>(() => (campaign.dimensions ? toEdit(campaign.dimensions) : null));
  const [count, setCount] = useState<WriteCount>(2);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<NoteState>(null);

  const themeValue = theme === AUTO_THEME ? null : theme;
  const kept = dims ? fromEdit(dims) : null;
  const short = dims ? shortOf(dims) : [];
  const dimsDirty = kept !== null && !sameDimensions(kept, campaign.dimensions);
  const fieldsDirty = (name.trim() || null) !== campaign.name || (hint.trim() || null) !== campaign.hint
    || (voice.trim() || null) !== campaign.brandVoice || themeValue !== campaign.theme;
  const dirty = fieldsDirty || dimsDirty;
  // an edit not saved yet may add designs; the server says when there are truly none left
  const exhausted = !dimsDirty && queue !== null && queue.next.length === 0;
  const left = queue ? queue.total - queue.made : 0;

  async function persist(): Promise<boolean> {
    if (!dirty) return true;
    if (short.length > 0) { setNote(errorNote("แต่ละมิติต้องติ๊กไว้อย่างน้อย 1 ข้อ")); return false; }
    setSaving(true);
    setNote(null);
    try {
      const res = await updateAdCampaign(campaign.id, {
        name, hint, brandVoice: voice, theme: themeValue, ...(dimsDirty && kept ? { dimensions: kept } : {}),
      });
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
    if (await persist()) setNote(okNote(dimsDirty ? "บันทึกแล้ว — มิติใหม่มีผลกับแอดที่ยังไม่ได้สร้างเท่านั้น" : "บันทึกการตั้งค่าแล้ว"));
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
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="flex justify-between text-sm font-medium">
                <span>สิ่งที่อยากเน้น</span>
                <span className="text-xs font-normal text-[var(--ct-mute)]">{[...hint].length}/{TEXT_MAX}</span>
              </span>
              <textarea value={hint} onChange={(e) => setHint(e.target.value)} maxLength={TEXT_MAX} rows={2} className={`${field} leading-relaxed`} />
            </label>
            <label className="block space-y-1">
              <span className="flex justify-between text-sm font-medium">
                <span>น้ำเสียงแบรนด์</span>
                <span className="text-xs font-normal text-[var(--ct-mute)]">{[...voice].length}/{TEXT_MAX}</span>
              </span>
              <textarea value={voice} onChange={(e) => setVoice(e.target.value)} maxLength={TEXT_MAX} rows={2} className={`${field} leading-relaxed`} />
            </label>
            <div>
              <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
              <ThemeSwatches<ThemeChoice> value={theme} onChange={setTheme} allowAuto />
            </div>
          </fieldset>
          {dims && kept && (
            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">มิติ</h3>
                <p className="text-xs text-[var(--ct-mute)]">แก้แล้วมีผลกับแอดที่ยังไม่ได้สร้างเท่านั้น · {comboLine(kept)}</p>
              </div>
              <DimensionsEditor value={dims} onChange={setDims} disabled={saving || writing} folded />
            </div>
          )}
          {dirty && (
            <button type="button" onClick={save} disabled={saving || writing || short.length > 0} className={`${plain} w-full`}>
              {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
            </button>
          )}
          <Note note={note} />
        </div>
      </details>
      {/* outside the fold: folding the settings away on a phone keeps the button */}
      <div className="sticky bottom-0 space-y-2 rounded-b-2xl border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
        {!campaign.dimensions ? (
          <Analyse campaignId={campaign.id} onDone={onAnalysed} />
        ) : (
          <>
            <div role="group" aria-label="จำนวนแอดที่จะสร้าง" className="flex gap-2">
              {WRITE_COUNTS.map((n) => (
                <button key={n} type="button" aria-pressed={count === n} disabled={writing || exhausted} onClick={() => setCount(n)} className={`${chip(count === n)} flex-1`}>{n}</button>
              ))}
            </div>
            <button type="button" onClick={write} disabled={writing || saving || exhausted || short.length > 0 || !campaign.pageConnected} className={`${solid} w-full`}>
              {writing ? "กำลังสร้างแอด…" : exhausted ? "สร้างครบทุกแบบแล้ว" : `สร้าง ${count} โฆษณา`}
            </button>
            {!campaign.pageConnected && <p role="note" className="text-xs font-medium text-[var(--ct-alert)]">เพจนี้ไม่ได้เชื่อมกับระบบแล้ว</p>}
            <p className="text-xs text-[var(--ct-mute)]">
              {exhausted
                ? "ทุกแบบของมิติตอนนี้สร้างไปแล้ว — เพิ่มฮุก กลุ่มคน มุมขาย หรือสไตล์ภาพเพื่อสร้างต่อ"
                : `${roundCost(count)} รวมวาดรูป · ราว 20–40 วินาที${queue && left < count ? ` · เหลือ ${left} แบบ` : ""}`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
