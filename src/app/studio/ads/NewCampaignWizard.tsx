"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/content/poster";
import { comboLine, fromEdit, shortOf, toEdit, type EditDims } from "@/lib/ads/dimension-edit";
import { roundCost, WRITE_COUNTS, type WriteCount } from "@/lib/ads/room-view";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "../ThemeSwatches";
import { errorNote, Note, type NoteState } from "../ui/editor-fields";
import { analyzeCampaignDraft, createAdCampaign } from "./actions";
import { DimensionsEditor } from "./DimensionsEditor";
import { chip, field, plain, solid, TONES } from "./styles";

/**
 * A new campaign in three steps, as Monoko's AD Studio has it (owner, 2026-10-04):
 * 1. the plan, and if the owner likes a name, what to stress, the brand's voice and the colour;
 * 2. the AI reads the plan and proposes the four dimensions (10–20 s, under a baht) — when it
 *    cannot answer, the starting set comes back instead and the page says so;
 * 3. the dimensions to tick off, reword and add to, how many designs they make, and how many
 *    ads to write first. Made, Ads Studio opens it and writes them (?campaign=<id>&write=<n>).
 * It sits in Ads Studio's tools column, one step under the other's place, folded away on a phone
 * like the settings it stands in for; ยกเลิก goes back to the campaign that was open.
 * Every step can be gone back to. Going forward again re-asks the AI only when the plan, the
 * focus or the voice changed — the owner's edits to the proposal are not thrown away for nothing.
 */

const STEP_TITLES = ["ข้อมูลแคมเปญ", "AI วิเคราะห์", "มิติและสร้าง"] as const;
const NAME_MAX = 60;
const TEXT_MAX = 120;

function StepBar({ step, reached, busy, onGo }: { step: number; reached: number; busy: boolean; onGo: (n: number) => void }) {
  return (
    <ol className="grid grid-cols-3 gap-1.5">
      {STEP_TITLES.map((t, i) => {
        const n = i + 1;
        const here = n === step;
        return (
          <li key={t}>
            <button
              type="button" disabled={busy || n > reached || here} onClick={() => onGo(n)} aria-current={here ? "step" : undefined}
              className={`flex min-h-11 w-full items-center gap-1.5 rounded-lg border px-1.5 py-1.5 text-left text-xs ${here ? "border-[var(--ct-solid)] font-semibold" : "border-[var(--ct-hair)] text-[var(--ct-mute)] enabled:hover:bg-[var(--ct-soft)]"}`}
            >
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${n <= reached ? "bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]" : "bg-[var(--ct-ground)]"}`}>{n}</span>
              <span className="min-w-0 break-words">{t}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

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

export function NewCampaignWizard({ pageId, products, folded, onCancel }: {
  pageId: string;
  products: { href: string; name: string }[];
  /** a phone with the tools folded */
  folded: boolean;
  /** back to the campaign that was open; null when the Page has none to go back to */
  onCancel: (() => void) | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  const [planHref, setPlanHref] = useState("");
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [voice, setVoice] = useState("");
  const [theme, setTheme] = useState<ThemeChoice>(AUTO_THEME);
  const [dims, setDims] = useState<EditDims | null>(null);
  const [fallback, setFallback] = useState(false);
  /** what the dimensions were analysed from; another plan, focus or voice asks again */
  const [analysedFor, setAnalysedFor] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [count, setCount] = useState<WriteCount>(2);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<NoteState>(null);
  const asking = useRef(false);

  const key = `${planHref}|${focus.trim()}|${voice.trim()}`;
  // dimensions analysed for another plan, focus or voice are not this campaign's: step 3 waits for a new analysis
  const fresh = dims !== null && analysedFor === key;
  const productName = products.find((p) => p.href === planHref)?.name ?? "";

  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!analysing) { setSeconds(0); return; }
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [analysing]);

  const go = (n: number) => { setNote(null); setStep(n); setReached((r) => Math.max(r, n)); };

  async function analyse() {
    if (asking.current || !planHref) return;
    asking.current = true;
    setAnalysing(true);
    setNote(null);
    go(2);
    try {
      const res = await analyzeCampaignDraft({ pageId, planHref, focus, voice });
      if (!res.ok) { setNote(errorNote(res.error)); return; }
      setDims(toEdit(res.dimensions));
      setFallback(res.fallback);
      setAnalysedFor(key);
      go(3);
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุดระหว่างรอ AI ลองใหม่อีกครั้ง"));
    } finally {
      asking.current = false;
      setAnalysing(false);
    }
  }

  function next() {
    if (!planHref) return;
    if (fresh) go(3);
    else void analyse();
  }

  async function create() {
    if (!dims || creating) return;
    setCreating(true);
    setNote(null);
    try {
      const res = await createAdCampaign({
        pageId, planHref, name: name.trim() || null, hint: focus, brandVoice: voice,
        theme: theme === AUTO_THEME ? null : (theme as Theme), dimensions: fromEdit(dims),
      });
      if (!res.ok) { setNote(errorNote(res.error)); setCreating(false); return; }
      // creating stays on until the room opens: a second press would make a second campaign
      router.push(`/studio/ads?campaign=${encodeURIComponent(res.id)}&write=${count}`);
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง — ถ้าแคมเปญขึ้นในรายการแล้ว ไม่ต้องสร้างซ้ำ"));
      setCreating(false);
    }
  }

  const short = dims ? shortOf(dims) : [];
  const busy = analysing || creating;

  return (
    <div className={`space-y-4 border-t border-[var(--ct-hair)] p-4 ${folded ? "hidden lg:block" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">แคมเปญใหม่</h3>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-lg px-2 text-sm text-[var(--ct-mute)] hover:bg-[var(--ct-ground)] disabled:opacity-50">ยกเลิก</button>}
      </div>

      <StepBar step={step} reached={fresh ? reached : Math.min(reached, 2)} busy={busy} onGo={go} />

      <div className="space-y-4">
        {step === 1 && (
          <>
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
            <div>
              <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
              <ThemeSwatches<ThemeChoice> value={theme} onChange={setTheme} allowAuto />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={next} disabled={!planHref || busy} className={`${solid} w-full`}>
                {fresh ? "ถัดไป" : "ถัดไป: ให้ AI วิเคราะห์"}
              </button>
              <span className="text-xs text-[var(--ct-mute)]">AI ใช้เวลาราว 10–20 วินาที ค่าใช้จ่ายไม่ถึง 1 บาท</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="font-semibold">AI วิเคราะห์ {productName}</h2>
              <p className="mt-0.5 text-sm text-[var(--ct-mute)]">อ่านข้อมูลแบบประกัน สิ่งที่อยากเน้น และน้ำเสียง แล้วเสนอ ฮุก 8–12 · กลุ่มคน 3–5 · มุมขาย 3–5 · สไตล์ภาพ 3–5</p>
            </div>
            {analysing ? (
              <div role="status" className="space-y-2">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-[var(--ct-accent)]">
                  <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                  กำลังวิเคราะห์…
                  <span className="font-normal tabular-nums text-[var(--ct-mute)]">{seconds} วินาที{seconds > 30 ? " — นานกว่าปกติ แต่ยังทำงานอยู่" : " (ปกติ 10–20 วินาที)"}</span>
                </p>
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[var(--ct-hair)]">
                  <div className="h-full rounded-full bg-[var(--ct-accent)] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(92, (seconds / 20) * 100)}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {fresh && <button type="button" onClick={() => go(3)} className={solid}>ใช้ผลนี้ ไปขั้นต่อไป</button>}
                <button type="button" onClick={() => void analyse()} disabled={busy} className={fresh ? plain : solid}>
                  {fresh ? "วิเคราะห์ใหม่ (แทนที่ที่แก้ไว้)" : "ลองวิเคราะห์อีกครั้ง"}
                </button>
                <button type="button" onClick={() => go(1)} className={plain}>ย้อนกลับ</button>
              </div>
            )}
          </>
        )}

        {step === 3 && dims && fresh && (
          <>
            {fallback && (
              <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
                AI ตอบไม่ได้ในรอบนี้ เลยใช้รายการตั้งต้นให้ก่อน — แก้ ติ๊กออก หรือเพิ่มเองได้ หรือกลับไปขั้น 2 ให้ AI วิเคราะห์ใหม่
              </p>
            )}
            <div>
              <h2 className="font-semibold">มิติของแคมเปญ</h2>
              <p className="mt-0.5 text-sm text-[var(--ct-mute)]">แต่ละแอดหยิบ ฮุก × กลุ่มคน × มุมขาย × สไตล์ภาพ อย่างละหนึ่ง เดินคิวไปจนครบทุกแบบโดยไม่ซ้ำ</p>
            </div>
            <DimensionsEditor value={dims} onChange={setDims} disabled={creating} />
            <p className="rounded-xl bg-[var(--ct-ground)] px-3 py-2 text-sm">
              ทั้งหมด <b className="tabular-nums">{comboLine(fromEdit(dims))}</b>
            </p>
            <div role="group" aria-label="จำนวนแอดชุดแรก">
              <span className="mb-1.5 block text-sm font-medium">สร้างแอดชุดแรก</span>
              <div className="flex flex-wrap items-center gap-2">
                {WRITE_COUNTS.map((n) => (
                  <button key={n} type="button" aria-pressed={count === n} disabled={creating} onClick={() => setCount(n)} className={chip(count === n)}>{n} ชิ้น</button>
                ))}
                <span className="text-xs text-[var(--ct-mute)]">{roundCost(count)} รวมวาดรูป</span>
              </div>
            </div>
            <button type="button" onClick={create} disabled={creating || short.length > 0} className={`${solid} w-full`}>
              {creating ? "กำลังสร้าง…" : `สร้างแคมเปญ แล้วสร้างแอด ${count} ชิ้น`}
            </button>
            {short.length > 0 && <p className="text-xs font-medium text-[var(--ct-alert)]">แต่ละมิติต้องติ๊กไว้อย่างน้อย 1 ข้อ</p>}
          </>
        )}
        <Note note={note} />
      </div>
    </div>
  );
}
