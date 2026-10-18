"use client";
import { useEffect, useState } from "react";
import { STORY_DEFAULT_TERM, STORY_PLANS, type StoryPlan } from "@/lib/story/plans";
import { previewStoryFigure } from "../quote-video/actions";

/**
 * ใส่เบี้ยจริงจากตาราง (owner's mockup, 2026-10-16): the plan, term, sex, age and sum as คลิปเล่าเรื่อง
 * asks them, with the premium the system's tables give. The AI puts that one figure in one scene.
 */

export interface FigureChoice { plan: StoryPlan; variant: string; sex: "M" | "F"; age: number; sumAssured: number }
type Premium = { annual: number; monthly: number } | { error: string } | null;

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";

export const DEFAULT_FIGURE: FigureChoice = { plan: "ISHIELD", variant: STORY_DEFAULT_TERM.ISHIELD, sex: "M", age: 40, sumAssured: 1_000_000 };

export function FigurePicker({ value, onChange, onPremium }: {
  value: FigureChoice;
  onChange: (v: FigureChoice) => void;
  /** the premium once worked out, null while it is being or cannot be */
  onPremium: (annual: number | null) => void;
}) {
  const [premium, setPremium] = useState<Premium>(null);
  const { plan, variant, sex, age, sumAssured } = value;
  useEffect(() => {
    setPremium(null);
    onPremium(null);
    const t = setTimeout(() => {
      previewStoryFigure({ plan, variant, sex, age, sumAssured })
        .then((r) => { setPremium(r); onPremium("error" in r ? null : r.annual); })
        .catch(() => setPremium({ error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    }, 300);
    return () => clearTimeout(t);
    // onPremium is the board's setter: stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, variant, sex, age, sumAssured]);

  const terms = STORY_PLANS.find((p) => p.code === plan)!.terms;
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--ct-line)] p-3">
      <div className="flex flex-wrap gap-2">
        {STORY_PLANS.map((p) => (
          <button key={p.code} type="button" className={chip(plan === p.code)} onClick={() => onChange({ ...value, plan: p.code, variant: STORY_DEFAULT_TERM[p.code] })}>{p.name}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="เพศ">
        <button type="button" className={chip(sex === "M")} onClick={() => onChange({ ...value, sex: "M" })}>ชาย</button>
        <button type="button" className={chip(sex === "F")} onClick={() => onChange({ ...value, sex: "F" })}>หญิง</button>
      </div>
      <div className="grid gap-3 @sm:grid-cols-3">
        <div>
          <label htmlFor="ps-term" className={label}>ระยะชำระ</label>
          <select id="ps-term" className={field} value={variant} onChange={(e) => onChange({ ...value, variant: e.target.value })}>
            {terms.map((t) => <option key={t.variant} value={t.variant}>{t.short}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ps-age" className={label}>อายุ</label>
          <select id="ps-age" className={field} value={age} onChange={(e) => onChange({ ...value, age: Number(e.target.value) })}>
            {Array.from({ length: 71 }, (_, i) => i).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ps-sum" className={label}>ทุนประกัน (บาท)</label>
          <input
            id="ps-sum" inputMode="numeric" className={field} value={sumAssured ? sumAssured.toLocaleString("en-US") : ""}
            onChange={(e) => onChange({ ...value, sumAssured: Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8)) || 0 })}
          />
        </div>
      </div>
      <div className="rounded-lg bg-[var(--ct-soft)] px-4 py-3 text-sm tabular-nums">
        {premium && !("error" in premium)
          ? <p><b className="text-base">ปีละ {premium.annual.toLocaleString("en-US")} บาท</b> <span className="text-[var(--ct-mute)]">· AI วางเลขนี้ในฉากเดียว ส่วนเลขอื่นห้ามเดา</span></p>
          : <p className="text-[var(--ct-mute)]">{premium && "error" in premium ? premium.error : "กำลังคิดเบี้ย…"}</p>}
      </div>
    </div>
  );
}
