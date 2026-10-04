"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { PiecePerson } from "@/lib/content/people";
import { anglesFor, MAX_READER, NICHES, type AngleId } from "@/lib/content/prompt";
import { adRoundCost } from "@/lib/ads/picture-picks";
import { tableAge } from "@/lib/ads/room-view";
import { PressBar } from "../ui/form-parts";
import { chip, field } from "./styles";

/**
 * The writing form in a campaign's tools column (owner, 2026-10-05), Organic Studio's own fields
 * for an ad round:
 * - มุมที่อยากเล่า: ให้ AI เลือก (each ad takes a different angle), one of Organic's angles (all
 *   take it, with different openings), or the owner's own words;
 * - คนอ่านคือใคร: ทุกคน, a niche, or typed;
 * - อายุในตารางเบี้ย: the age every ad's premium table is priced at, kept in this browser;
 * - the press, pinned at the column's foot: − / + for 1–4 ads, what the round costs about, and
 *   สร้าง N โฆษณา. The folds handed in (`children`) sit between the fields and the press, so the
 *   press stays the last thing in the column.
 * The plan, Page, focus, voice and ภาพและโมเดล are the campaign's; the server reads them there.
 */

export interface WriteInput { angle: AngleId; custom: string; reader: string; age: number; count: number }

const MAX_COUNT = 4;
const CUSTOM_MAX = 120;
const AGE_KEY = "ads-table-age";
const AGE_DEFAULT = "30";

export function WriteForm({ planHref, picks, writing, disabled, warning = null, folded, onWrite, children }: {
  planHref: string;
  /** the campaign's saved writer, painter and person, for the price */
  picks: { writer: string | null; painter: string | null; person: PiecePerson | null };
  /** a round is being written: the press stays shut until it is back */
  writing: boolean;
  /** the press may not be used (the Page is gone) */
  disabled: boolean;
  /** why, under the press */
  warning?: string | null;
  /** a phone with the tools folded: only the press shows */
  folded: boolean;
  onWrite: (input: WriteInput) => void;
  children?: ReactNode;
}) {
  const formId = useId();
  const [angle, setAngle] = useState<AngleId>("");
  const [custom, setCustom] = useState("");
  const [reader, setReader] = useState("");
  const [ageText, setAgeText] = useState(AGE_DEFAULT);
  const [count, setCount] = useState(2);

  // the age last used in this browser; the server render starts at 30
  useEffect(() => {
    try {
      const kept = localStorage.getItem(AGE_KEY);
      if (kept !== null && tableAge(kept) !== null) setAgeText(kept);
    } catch { /* storage unavailable */ }
  }, []);
  const age = tableAge(ageText);
  const changeAge = (v: string) => {
    setAgeText(v);
    if (tableAge(v) === null) return;
    try { localStorage.setItem(AGE_KEY, v.trim()); } catch { /* not kept */ }
  };

  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!writing) { setSeconds(0); return; }
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [writing]);

  const customMissing = angle === "custom" && !custom.trim();
  const press = () => {
    if (age === null || customMissing) return;
    onWrite({ angle, custom: angle === "custom" ? custom.trim() : "", reader: reader.trim(), age, count });
  };

  return (
    <>
      <div className={`space-y-4 border-t border-[var(--ct-hair)] p-4 ${folded ? "hidden lg:block" : ""}`}>
        <fieldset disabled={writing} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <legend className="sr-only">เขียนแอด</legend>
          <div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
              <select value={angle} onChange={(e) => setAngle(e.target.value as AngleId)} className={field}>
                <option value="">ให้ AI เลือก</option>
                {anglesFor("ad", planHref).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                <option value="custom">พิมพ์เอง…</option>
              </select>
            </label>
            {angle === "custom" && (
              <label className="mt-2 block">
                <span className="sr-only">มุมที่อยากเล่า (พิมพ์เอง)</span>
                <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={CUSTOM_MAX} placeholder="เช่น ทำไมยิ่งอายุมากยิ่งซื้อยาก" className={field} />
              </label>
            )}
            {count > 1 && (
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">{angle ? "ทุกชิ้นเล่ามุมนี้ เปิดเรื่องคนละแบบ" : "แต่ละชิ้นเล่าคนละมุม"}</span>
            )}
          </div>

          <div role="group" aria-labelledby={`${formId}-reader`}>
            <span id={`${formId}-reader`} className="mb-1.5 block text-sm font-medium">คนอ่านคือใคร</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={reader === ""} onClick={() => setReader("")} className={chip(reader === "")}>ทุกคน</button>
              {NICHES.map((n) => (
                <button key={n} type="button" aria-pressed={reader === n} onClick={() => setReader(n)} className={chip(reader === n)}>{n}</button>
              ))}
            </div>
            <label className="mt-2 block">
              <span className="sr-only">คนอ่าน (พิมพ์เอง)</span>
              <input value={reader} onChange={(e) => setReader(e.target.value)} maxLength={MAX_READER} placeholder="หรือพิมพ์เอง เช่น พยาบาลกะดึก" className={field} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">อายุในตารางเบี้ย</span>
            <input
              value={ageText} onChange={(e) => changeAge(e.target.value)} type="number" inputMode="numeric" min={0} max={80} step={1}
              aria-invalid={age === null} className={`${field} max-w-28 tabular-nums`}
            />
            <span className={`mt-1 block text-xs ${age === null ? "font-medium text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>
              {age === null ? "ใส่อายุเป็นจำนวนเต็ม 0–80" : "ทุกแอดในรอบนี้คิดเบี้ยที่อายุนี้ ทั้งหญิงและชาย ระบบจำไว้ให้"}
            </span>
          </label>
        </fieldset>
      </div>

      {children}

      <PressBar
        count={count} max={MAX_COUNT} onCount={setCount} unit="แอด"
        label={writing ? "กำลังสร้างแอด…" : `สร้าง ${count} โฆษณา`}
        onPress={press}
        disabled={writing || disabled || age === null || customMissing}
        note={writing
          ? `กำลังเขียน ${seconds} วินาที${seconds > 60 ? " — นานกว่าปกติ แต่ยังทำงานอยู่" : " (ปกติ 20–40 วินาที)"}`
          : `${adRoundCost(count, picks)} รวมวาดรูป · ราว 20–40 วินาที`}
        warning={warning}
      />
    </>
  );
}
