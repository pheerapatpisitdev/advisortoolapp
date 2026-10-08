"use client";
import { useState } from "react";
import { formatBaht } from "@/calc/money";
import type { PageBudget } from "@/lib/budget-sum";

/** The amounts a visitor taps instead of typing, and the slider's reach, for each way of naming a budget. */
const KINDS = {
  month: { presets: [1_000, 3_000, 5_000, 10_000], min: 1_000, max: 100_000, step: 500, label: "ต่อเดือน", unit: "บาท / เดือน" },
  year: { presets: [20_000, 50_000, 100_000, 200_000], min: 10_000, max: 1_000_000, step: 5_000, label: "ต่อปี", unit: "บาท / ปี" },
} as const;

const short = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000} ล้าน` : n >= 100_000 ? `${n / 100_000} แสน` : n >= 10_000 ? `${n / 10_000} หมื่น` : `${n / 1_000} พัน`);

export interface BudgetBoxProps {
  /** unique per page, so the field's label finds its input */
  id: string;
  budget: PageBudget;
  onChange: (budget: PageBudget) => void;
}

/**
 * The field a visitor names what they can pay in: the amount is the figure itself (tap it to
 * type), with presets and a slider for the thumb, and a switch between a month's and a year's.
 * Moving between the two keeps the visitor's money — a yearly figure becomes the monthly one
 * that is a twelfth of it — rather than leaving a hundred thousand a month on the screen.
 */
export function BudgetBox({ id, budget, onChange }: BudgetBoxProps) {
  const kind = KINDS[budget.per];
  // the amount as it is being typed; null once it has landed
  const [typed, setTyped] = useState<string | null>(null);
  const settle = () => {
    const digits = typed?.replace(/\D/g, "") ?? "";
    if (digits !== "") onChange({ ...budget, baht: Number(digits) });
    setTyped(null);
  };
  const choose = (per: PageBudget["per"]) => {
    if (per === budget.per) return;
    const baht = per === "month" ? Math.round(budget.baht / 12 / 500) * 500 : budget.baht * 12;
    onChange({ per, baht: Math.max(baht, KINDS[per].min) });
  };
  const on = "lg-metal-face border-[var(--lg-gold)] font-medium";
  const off = "border-[var(--lg-panel-line)] text-[var(--lg-mute)]";

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-[var(--lg-mute)]">งบเบี้ยประกัน</label>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {(["month", "year"] as const).map((per) => (
          <button
            key={per} type="button" aria-pressed={budget.per === per} onClick={() => choose(per)}
            className={`rounded-sm border py-2 text-sm transition-colors ${budget.per === per ? on : off}`}
          >
            {KINDS[per].label}
          </button>
        ))}
      </div>
      <div className="lg-figure mt-3 flex items-baseline gap-2 text-3xl tabular-nums">
        <input
          id={id} type="text" inputMode="numeric" autoComplete="off"
          value={typed ?? budget.baht.toLocaleString("en-US")}
          placeholder={budget.baht.toLocaleString("en-US")}
          onFocus={() => setTyped("")}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
            setTyped(digits === "" ? "" : Number(digits).toLocaleString("en-US"));
          }}
          onBlur={settle}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="lg-metal-text w-[9ch] border-b border-dashed border-[var(--lg-hair)] bg-transparent outline-none focus:border-[var(--lg-gold)]"
        />
        <span className="text-lg text-[var(--lg-mute)]">{kind.unit}</span>
      </div>
      <input
        aria-label="งบเบี้ยประกัน" type="range" min={kind.min} max={kind.max} step={kind.step}
        value={Math.min(Math.max(budget.baht, kind.min), kind.max)}
        onChange={(e) => onChange({ ...budget, baht: Number(e.target.value) })}
        className="mt-3 w-full accent-[var(--lg-gold)]"
      />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {kind.presets.map((p) => (
          <button
            key={p} type="button" aria-pressed={budget.baht === p} onClick={() => onChange({ ...budget, baht: p })}
            className={`rounded-sm border py-2 text-sm tabular-nums transition-colors ${budget.baht === p ? on : off}`}
          >
            {short(p)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The switch above the sum: name the sum, or name what can be paid and let the page find the sum. */
export function BudgetSwitch({ byBudget, onChange }: { byBudget: boolean; onChange: (byBudget: boolean) => void }) {
  const on = "lg-metal-face border-[var(--lg-gold)] font-medium";
  const off = "border-[var(--lg-panel-line)] text-[var(--lg-mute)]";
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="เลือกวิธีคำนวณ">
      <button type="button" aria-pressed={!byBudget} onClick={() => onChange(false)}
        className={`rounded-sm border py-2.5 text-sm transition-colors ${!byBudget ? on : off}`}>รู้ทุนที่ต้องการ</button>
      <button type="button" aria-pressed={byBudget} onClick={() => onChange(true)}
        className={`rounded-sm border py-2.5 text-sm transition-colors ${byBudget ? on : off}`}>มีงบต่อปี / ต่อเดือน</button>
    </div>
  );
}

export interface BudgetOutcomeProps {
  budget: PageBudget;
  /** what the budget buys on the term in view, or undefined when it does not reach the plan's smallest sum */
  fit: { sum: number; total: number; over: boolean } | undefined;
  /** the plan's smallest sum and what it costs in the budget's own mode, in satang — said when the budget is short */
  least: { sum: number; total: number } | undefined;
  /** the smallest monthly instalment the company takes, in baht */
  minMonthly: number;
}

/**
 * What the budget buys, under the field: the sum, the instalment it really costs, and what is
 * left of the money — or, when the money does not reach the plan's smallest sum, that, with the
 * figure it would take. A budget is never lifted to the minimum without being told.
 */
export function BudgetOutcome({ budget, fit, least, minMonthly }: BudgetOutcomeProps) {
  const per = budget.per === "month" ? "เดือน" : "ปี";
  // the same formatting the quotation uses, so one instalment never shows as two figures
  const baht = formatBaht;
  if (!fit) {
    return (
      <p role="status" className="mt-4 text-sm leading-relaxed text-[var(--lg-gold)]">
        งบนี้ยังไม่ถึงทุนขั้นต่ำของแบบนี้
        {least && <> · ทุนต่ำสุด {least.sum.toLocaleString("en-US")} บาท เบี้ย {baht(least.total)} บาท/{per}</>}
        {" "}ลองเพิ่มงบ หรือเลือกงวดชำระเบี้ยที่ยาวกว่า
      </p>
    );
  }
  return (
    <div className="mt-4" role="status">
      <p className="text-sm text-[var(--lg-mute)]">ทำทุนประกันได้สูงสุด</p>
      <p className="lg-figure text-3xl tabular-nums">
        <span className="lg-metal-text">{fit.sum.toLocaleString("en-US")}</span>{" "}
        <span className="text-lg text-[var(--lg-mute)]">บาท</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--lg-mute)]">
        เบี้ยจริง {baht(fit.total)} บาท/{per}
        {fit.over
          ? ` · เกินงบเล็กน้อย เพราะรายเดือนต้องไม่ต่ำกว่า ${minMonthly.toLocaleString("en-US")} บาท`
          : ` · เหลืองบ ${baht(budget.baht * 100 - fit.total)} บาท · ทุนเลือกได้ตามขั้นที่แผนนี้ขาย`}
      </p>
    </div>
  );
}
