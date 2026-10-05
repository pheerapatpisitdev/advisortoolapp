"use client";
import { useEffect, useState } from "react";
import { headlinePreview } from "./actions";
import { TONES } from "./styles";

/**
 * The create drawer's figure preview (Ads Studio desktop, 2026-10-05): what the code will place in
 * every ad of the round at the age, sex and row chosen — the 💁‍♀️/💰 headline lines and the premium
 * table — read from the server (headlinePreview) once the choice has rested, so the owner sees the
 * figures before paying. Nothing is asked until the age's rows are in (WriteForm's `ready`), so
 * the row is the one the round will use; a stale answer (the choice changed meanwhile) is dropped.
 */

/** how long a choice must rest before its figures are asked for */
const WAIT_MS = 350;

type Shown = { key: string; headline: string; table: string; error: null } | { key: string; headline: null; table: null; error: string };

export function HeadlinePreview({ campaignId, english = false, age, sex, rung, ready }: {
  campaignId: string;
  /** an English campaign (campaignLang): its figures come back in English, and the heading says so */
  english?: boolean;
  /** the table age; null while the field is not a whole year 0–80 */
  age: number | null;
  sex: "F" | "M";
  /** the row the headline names; undefined for the middle one */
  rung?: number;
  /** the age's rows are in, so `rung` is the row the round will use: nothing is asked before */
  ready: boolean;
}) {
  const key = age === null || !ready ? null : `${campaignId}|${age}|${sex}|${rung ?? ""}`;
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (key === null || age === null) return;
    let live = true;
    const wait = window.setTimeout(() => {
      headlinePreview(campaignId, { age, sex, ...(rung === undefined ? {} : { rung }) })
        .then((r) => {
          if (!live) return;
          setShown(r.ok ? { key, headline: r.headline, table: r.table, error: null } : { key, headline: null, table: null, error: r.error });
        })
        .catch(() => { if (live) setShown({ key, headline: null, table: null, error: "โหลดตัวอย่างตัวเลขไม่ได้ ลองเปลี่ยนค่าอีกครั้ง" }); });
    }, WAIT_MS);
    return () => { live = false; window.clearTimeout(wait); };
  }, [key, campaignId, age, sex, rung]);

  // the last answer stays (dimmed) while the next is on its way, so the pane does not jump
  const fresh = shown !== null && shown.key === key;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          ตัวเลขที่จะอยู่ในแอด
          {english && <span className="ml-2 rounded-full bg-[var(--ct-soft)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--ct-accent)]">EN · ภาษาอังกฤษ</span>}
        </h3>
        <span role="status" aria-live="polite" className="text-xs text-[var(--ct-mute)]">
          {age === null || fresh ? "" : "กำลังโหลด…"}
        </span>
      </div>
      {age === null ? (
        <p className="rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-4 text-sm text-[var(--ct-mute)]">ใส่อายุในตารางเบี้ยก่อน แล้วจะเห็นตัวเลขที่นี่</p>
      ) : shown === null ? (
        <p className="rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-4 text-sm text-[var(--ct-mute)]">กำลังโหลดตัวอย่าง…</p>
      ) : shown.error !== null ? (
        <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad} ${fresh ? "" : "opacity-60"}`}>{shown.error}</p>
      ) : (
        <div className={`space-y-3 transition-opacity ${fresh ? "" : "opacity-60"}`}>
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--ct-mute)]">หัวแอด</p>
            <p className="whitespace-pre-wrap rounded-lg bg-[var(--ct-ground)] px-3 py-2 text-sm leading-relaxed">{shown.headline}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--ct-mute)]">ตารางเบี้ย</p>
            <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--ct-ground)] px-3 py-2 text-sm leading-relaxed tabular-nums">{shown.table}</p>
          </div>
          <p className="text-xs text-[var(--ct-mute)]">ทุกแอดในรอบนี้ใช้ตัวเลขชุดนี้ จากตารางเบี้ยในระบบ</p>
        </div>
      )}
    </div>
  );
}
