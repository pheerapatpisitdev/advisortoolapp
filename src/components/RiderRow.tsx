"use client";
import { useState } from "react";
import type { Availability, Sex } from "@/calc/types";
import { riderDiseases } from "@/calc/riders/diseases";
import { MoneyInput } from "./MoneyInput";

export interface SubSelect {
  key: "territory" | "coverage";
  label: string;
  choices: string[];
}
export interface RiderRowProps {
  availability: Availability;
  enabled: boolean;
  value: number | "";
  option: string;
  territory: string;
  coverage: string;
  /** who the quote is for; PB is rated on the same person, so it is shown rather than asked */
  insured: { age: number | ""; sex: Sex };
  /** the option select also needs a sum assured (PLS) */
  optionNeedsSumAssured: boolean;
  /** extra selects shown after the option (iHealthy Ultra) */
  subSelects: SubSelect[];
  /** the package requires this rider: ticked and locked */
  required: boolean;
  onToggle: (enabled: boolean) => void;
  onChange: (value: number | "") => void;
  onOptionChange: (option: string) => void;
  onSubSelectChange: (key: SubSelect["key"], value: string) => void;
}

const num = (v: string): number | "" => (v === "" ? "" : Number(v));

/** The illnesses a rider names, folded away until asked for. */
function DiseaseList({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const info = riderDiseases(code);
  if (!info) return null;
  return (
    <div className="mt-1 basis-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-[var(--op-mute)] underline decoration-dotted underline-offset-2"
      >
        {open ? "ซ่อนรายชื่อโรค" : `ดูรายชื่อ ${info.diseases.length} โรคที่คุ้มครอง`}
      </button>
      {open && (
        <div className="mt-1 rounded border bg-[var(--op-ground)] p-2">
          <p className="mb-1 text-xs text-[var(--op-mute)]">{info.note}</p>
          <ol className="grid gap-x-4 gap-y-0.5 text-xs text-[var(--op-ink)] sm:grid-cols-2">
            {info.diseases.map((d, i) => (
              <li key={d} className="flex gap-1.5">
                <span className="shrink-0 tabular-nums text-[var(--op-mute)]">{i + 1}.</span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function RiderRow({
  availability: a, enabled, value, option, territory, coverage, insured, optionNeedsSumAssured, subSelects, required,
  onToggle, onChange, onOptionChange, onSubSelectChange,
}: RiderRowProps) {
  const disabled = !a.eligible;
  const isPlan = a.plans !== undefined;
  const showSumAssured = !a.needsPayer && !isPlan && (!a.options || optionNeedsSumAssured);
  return (
    <div className={`rounded-md border p-3 ${disabled ? "border-[var(--op-line)] bg-[var(--op-disabled)] text-[var(--op-mute)]" : "border-[var(--op-line)] bg-[var(--op-panel)]"}`}>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-4 w-4" checked={(enabled || required) && !disabled} disabled={disabled || required} onChange={(e) => onToggle(e.target.checked)} />
        <span className="flex-1 text-sm font-medium">{a.name}{required && <span className="ml-2 text-xs text-[var(--bot-navy)]">(บังคับตามแพ็กเกจ)</span>}</span>
        <span className="text-xs">{a.ageRange}</span>
      </label>
      {disabled && <p className="mt-1 text-xs">{a.reason}</p>}
      {!disabled && (enabled || required) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {a.options && (
            <select className="rounded border px-2 py-1 text-sm" value={option} onChange={(e) => onOptionChange(e.target.value)}>
              <option value="">เลือกแบบ</option>
              {a.options.map((o) => (
                <option key={o.code} value={o.code}>{o.name}</option>
              ))}
            </select>
          )}
          {subSelects.map((sub) => (
            <select key={sub.key} className="rounded border px-2 py-1 text-sm" title={sub.label}
                    value={sub.key === "territory" ? territory : coverage}
                    onChange={(e) => onSubSelectChange(sub.key, e.target.value)}>
              {sub.choices.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ))}
          {a.needsPayer ? (
            <span className="text-xs text-[var(--op-mute)]">
              ผู้ชำระเบี้ยคือผู้เอาประกัน
              {insured.age !== "" && ` · ${insured.sex === "M" ? "ชาย" : "หญิง"} ${insured.age} ปี`}
            </span>
          ) : isPlan ? (
            <select className="rounded border px-2 py-1 text-sm" value={value} onChange={(e) => onChange(num(e.target.value))}>
              <option value="">เลือกแผน</option>
              {a.plans!.map((p) => (
                <option key={p} value={p}>{p.toLocaleString("en-US")}</option>
              ))}
            </select>
          ) : showSumAssured ? (
            <>
              <MoneyInput
                className="w-40 rounded border px-2 py-1 text-sm" placeholder="ทุนประกัน"
                value={value} onChange={onChange} max={a.saMax}
              />
              <span className="text-xs text-[var(--op-mute)]">
                {a.saMin?.toLocaleString("en-US")}{a.saMax !== undefined ? ` – ${a.saMax.toLocaleString("en-US")}` : ""}
              </span>
            </>
          ) : null}
          {/* AP and ECARE are priced at one occupation class; the row says which (review 2026-10-01) */}
          {a.note && <span className="text-xs text-[var(--op-mute)]">{a.note}</span>}
          <DiseaseList code={a.code} />
        </div>
      )}
    </div>
  );
}
