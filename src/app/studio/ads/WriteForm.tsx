"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { PiecePerson } from "@/lib/content/people";
import { anglesFor, MAX_READER, NICHES, type AngleId } from "@/lib/content/prompt";
import { adRoundCost } from "@/lib/ads/picture-picks";
import { tableAge } from "@/lib/ads/room-view";
import { PressBar } from "../ui/form-parts";
import { tableRows } from "./actions";
import { chip, field } from "./styles";

/**
 * The writing form in a campaign's tools column (owner, 2026-10-05), Organic Studio's own fields
 * for an ad round:
 * - มุมที่อยากเล่า: ให้ AI เลือก (each ad takes a different angle), one of Organic's angles (all
 *   take it, with different openings), or the owner's own words;
 * - คนอ่านคือใคร: ทุกคน, a niche, or typed;
 * - อายุในตารางเบี้ย: the age every ad's premium table is priced at, kept in this browser;
 * - เพศในหัวแอด and ทุนในหัวแอด (2026-10-05): whose premium the headline shows, and which row of
 *   the table it names — the rows asked of the server for the age (the rates are too big for the
 *   browser), the middle one until another is picked. The table itself still prints every row;
 * - the press, pinned at the column's foot: − / + for 1–4 ads, what the round costs about, and
 *   สร้าง N โฆษณา. The folds handed in (`children`) sit between the fields and the press, so the
 *   press stays the last thing in the column.
 * The plan, Page, focus, voice and ภาพและโมเดล are the campaign's; the server reads them there.
 */

export interface WriteInput {
  angle: AngleId; custom: string; reader: string; age: number; count: number;
  /** whose premium the headline shows */
  sex: "F" | "M";
  /** the table row the headline names, an index into its rows; absent for the middle one */
  rung?: number;
}

/** the table's rows at an age, as the server gave them, or why there are none */
type Rows = { age: number; rows: { index: number; heading: string }[]; middle: number; error: string | null };

const MAX_COUNT = 4;
const CUSTOM_MAX = 120;
const AGE_KEY = "ads-table-age";
const AGE_DEFAULT = "30";
/** how long the age must rest before its rows are asked for */
const ROWS_WAIT_MS = 300;

export function WriteForm({ campaignId, planHref, picks, writing, disabled, warning = null, folded, onWrite, children }: {
  campaignId: string;
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
  const [sex, setSex] = useState<"F" | "M">("F");
  /**
   * the picked row: its heading, so the pick survives an age whose table drops a row, and its
   * index, for an age whose headings change (Life Protect's doubled cover is gone at 60); null is the middle row
   */
  const [head, setHead] = useState<{ heading: string; index: number } | null>(null);
  const [rows, setRows] = useState<Rows | null>(null);

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

  // the table's rows for the age, once it has rested; a stale answer is dropped
  useEffect(() => {
    if (age === null) return;
    let live = true;
    const wait = window.setTimeout(() => {
      tableRows(campaignId, age)
        .then((r) => {
          if (!live) return;
          setRows(r.ok ? { age, rows: r.rows, middle: r.middle, error: null } : { age, rows: [], middle: 0, error: r.error });
        })
        .catch(() => { if (live) setRows({ age, rows: [], middle: 0, error: "โหลดรายการทุนไม่ได้ หัวแอดจะใช้แถวกลางของตาราง" }); });
    }, ROWS_WAIT_MS);
    return () => { live = false; window.clearTimeout(wait); };
  }, [campaignId, age]);
  const shownRows = rows && rows.age === age ? rows : null;
  const byHeading = shownRows && head ? shownRows.rows.findIndex((r) => r.heading === head.heading) : -1;
  const picked = byHeading >= 0 ? byHeading : head && shownRows && head.index < shownRows.rows.length ? head.index : -1;
  const rung = shownRows && shownRows.rows.length > 0 ? (picked >= 0 ? picked : shownRows.middle) : undefined;

  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!writing) { setSeconds(0); return; }
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [writing]);

  const customMissing = angle === "custom" && !custom.trim();
  // the press waits for the age's rows, so the row sent is one of the table the server prices
  const rowsPending = age !== null && shownRows === null;
  const press = () => {
    if (age === null || customMissing || rowsPending) return;
    onWrite({ angle, custom: angle === "custom" ? custom.trim() : "", reader: reader.trim(), age, count, sex, ...(rung === undefined ? {} : { rung }) });
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

          <div>
            <div role="group" aria-labelledby={`${formId}-sex`} aria-describedby={`${formId}-head-note`}>
              <span id={`${formId}-sex`} className="mb-1.5 block text-sm font-medium">เพศในหัวแอด</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={sex === "F"} onClick={() => setSex("F")} className={chip(sex === "F")}>หญิง</button>
                <button type="button" aria-pressed={sex === "M"} onClick={() => setSex("M")} className={chip(sex === "M")}>ชาย</button>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium">ทุนในหัวแอด</span>
              <select
                value={rung ?? ""} aria-describedby={`${formId}-head-note`}
                onChange={(e) => {
                  const row = shownRows?.rows[Number(e.target.value)];
                  setHead(row ? { heading: row.heading, index: row.index } : null);
                }}
                disabled={!shownRows || shownRows.rows.length === 0} className={field}
              >
                {!shownRows || shownRows.rows.length === 0
                  ? <option value="">{age !== null && !shownRows ? "กำลังโหลด…" : "—"}</option>
                  : shownRows.rows.map((r) => <option key={r.index} value={r.index}>{r.heading}</option>)}
              </select>
            </label>
            <span id={`${formId}-head-note`} role="status" aria-live="polite" className={`mt-1 block text-xs ${shownRows?.error ? "font-medium text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>
              {shownRows?.error ?? "หัวแอดใช้ทุนและเพศนี้ — ตารางยังแสดงครบทุกแถว"}
            </span>
          </div>
        </fieldset>
      </div>

      {children}

      <PressBar
        count={count} max={MAX_COUNT} onCount={setCount} unit="แอด"
        label={writing ? "กำลังสร้างแอด…" : `สร้าง ${count} โฆษณา`}
        onPress={press}
        disabled={writing || disabled || age === null || customMissing || rowsPending}
        note={writing
          ? `กำลังเขียน ${seconds} วินาที${seconds > 60 ? " — นานกว่าปกติ แต่ยังทำงานอยู่" : " (ปกติ 20–40 วินาที)"}`
          : `${adRoundCost(count, picks)} รวมวาดรูป · ราว 20–40 วินาที`}
        warning={warning}
      />
    </>
  );
}
