"use client";

import { useState } from "react";
import type { CardRiders } from "@/lib/card-link";
import { illnessSaMax } from "@/lib/lifeprotect-quote";
import type { LpRiderMenu } from "@/lib/quote-video/lp-rider-menu";
import type { LifeProtectIllness } from "@/lib/lifeprotect-table";
import { OCCUPATION_NOTE } from "@/calc/riders/rate-per-thousand";

/**
 * Life Protect's riders, picked on the วิดีโอนำเสนอ form itself (owner, 2026-11-18, ข then 1ก 2ข on
 * mockup https://claude.ai/artifact/VvQvFVKLcmd58U9xz5cn3C). Until then they came only with a press of
 * สร้างวิดีโอ on the /lifeprotect page, and went when the form turned to a budget.
 *
 * Folded behind one button until asked for (2ข); open from the start when the page sent some.
 * Nothing is priced here: the server prices what is picked and says when it cannot be bought
 * (actions.ts), so this only keeps the choice inside what each rider is sold at.
 */

const chip = (on: boolean, off = false) =>
  `min-h-9 rounded-full border px-3 py-1 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}${off ? " opacity-40" : ""}`;

/** the sums offered as buttons, as on the page; any other is typed */
const SUMS = [500_000, 1_000_000, 2_000_000];
const STEP = 10_000;
const sumWord = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000} ล้าน` : `${n / 100_000} แสน`);
const ages = (min: number, max: number) => `รับอายุ ${min === 0 ? "แรกเกิด" : min}–${max} ปี`;

export function LpRiderPicker({ menu, age, baseSum, value, onChange }: {
  menu: LpRiderMenu;
  age: number;
  /** the plan's sum the riders are held to; undefined from a budget, where the server works it out */
  baseSum: number | undefined;
  value: CardRiders | undefined;
  onChange: (riders: CardRiders | undefined) => void;
}) {
  const [open, setOpen] = useState(Boolean(value));
  const [typed, setTyped] = useState<Record<string, string>>({});
  const known = Number.isInteger(age);

  /** what is picked with one part changed; nothing left is no riders at all */
  const set = (part: Partial<CardRiders>, drop: (keyof CardRiders)[] = []) => {
    const next: CardRiders = { ...value, ...part };
    for (const k of drop) delete next[k];
    if (next.illness?.length === 0) delete next.illness;
    onChange(Object.keys(next).length ? next : undefined);
  };

  if (!open) {
    return (
      <button type="button" className="min-h-11 rounded-lg border border-dashed border-[var(--ct-line)] px-4 py-2 text-sm text-[var(--ct-accent)] hover:bg-[var(--ct-ground)]" onClick={() => setOpen(true)}>
        + ใส่สัญญาเพิ่มเติม
      </button>
    );
  }

  const wp = menu.waiver;
  const wpSold = !known || !wp || (age >= wp.ageMin && age <= wp.ageMax);
  const meb = menu.medical;
  const mebMax = meb && known ? meb.maxAt[age - menu.ageMin] ?? 0 : undefined;
  const picked = (code: string) => value?.illness?.find((i) => i.code === code);
  const setIllness = (code: string, sumAssured: number | null) => {
    const rest = (value?.illness ?? []).filter((i) => i.code !== code);
    // kept in the page's order, which is the order the card and the link write them in
    const next = sumAssured === null ? rest : menu.illness.flatMap((r) => (r.code === code ? [{ code, sumAssured }] : rest.filter((i) => i.code === r.code)));
    set({ illness: next });
  };
  const groups = [
    { group: "illness" as const, title: "โรคร้ายแรง" },
    { group: "accident" as const, title: "อุบัติเหตุ" },
  ];

  return (
    <div className="space-y-3 rounded-lg border-[1.5px] border-[var(--ct-accent)] px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">สัญญาเพิ่มเติม</p>
        <button type="button" className="text-xs text-[var(--ct-mute)] underline" onClick={() => { onChange(undefined); setTyped({}); setOpen(false); }}>ไม่ใส่สัญญาเพิ่มเติม</button>
      </div>

      {wp && (
        <div>
          <p className="mb-1 font-medium">ยกเว้นเบี้ย ({wp.code})</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ยกเว้นเบี้ย">
            <button type="button" aria-pressed={!value?.waiver} className={chip(!value?.waiver)} onClick={() => set({}, ["waiver", "payer"])}>ไม่เอา</button>
            {wp.options.map((o) => {
              const on = value?.waiver?.code === wp.code && value.waiver.option === o.code;
              return <button key={o.code} type="button" disabled={!wpSold} aria-pressed={on} className={chip(on, !wpSold)} onClick={() => set({ waiver: { code: wp.code, option: o.code } }, ["payer"])}>{o.word}</button>;
            })}
          </div>
          {!wpSold && <p className="mt-1 text-xs text-[var(--ct-mute)]">{ages(wp.ageMin, wp.ageMax)}</p>}
        </div>
      )}

      {meb && (
        <div>
          <p className="mb-1 font-medium">ค่าชดเชยรายวัน (MEB) · วันละ</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ค่าชดเชยรายวัน">
            <button type="button" aria-pressed={value?.medical === undefined} className={chip(value?.medical === undefined)} onClick={() => set({}, ["medical"])}>ไม่เอา</button>
            {meb.plans.map((p) => {
              const sold = mebMax === undefined || p <= mebMax;
              return <button key={p} type="button" disabled={!sold} aria-pressed={value?.medical === p} className={chip(value?.medical === p, !sold)} onClick={() => set({ medical: p })}>{p.toLocaleString("en-US")}</button>;
            })}
          </div>
          {mebMax !== undefined && mebMax < meb.plans[meb.plans.length - 1] && (
            <p className="mt-1 text-xs text-[var(--ct-mute)]">{mebMax === 0 ? ages(meb.ageMin, meb.ageMax) : `อายุนี้ซื้อได้สูงสุดวันละ ${mebMax.toLocaleString("en-US")}`}</p>
          )}
        </div>
      )}

      {groups.map(({ group, title }) => {
        const list = menu.illness.filter((r) => r.group === group);
        if (list.length === 0) return null;
        return (
          <div key={group} className="space-y-2">
            <p className="font-medium">{title}</p>
            {list.map((r) => {
              const sold = !known || (age >= r.ageMin && age <= r.ageMax);
              // only the cap and the base limit are read, which the menu carries
              const max = illnessSaMax(r as LifeProtectIllness, known ? age : 35, baseSum);
              const at = picked(r.code);
              const start = Math.min(max, Math.max(r.saMin, baseSum ?? 1_000_000));
              const settle = () => {
                const digits = (typed[r.code] ?? "").replace(/\D/g, "");
                if (digits !== "") setIllness(r.code, Math.min(max, Math.max(r.saMin, Math.round(Number(digits) / STEP) * STEP)));
                setTyped((t) => Object.fromEntries(Object.entries(t).filter(([code]) => code !== r.code)));
              };
              return (
                <div key={r.code}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{r.short}</span>
                    <div className="flex gap-2" role="group" aria-label={r.short}>
                      <button type="button" aria-pressed={!at} className={chip(!at)} onClick={() => setIllness(r.code, null)}>ไม่เอา</button>
                      <button type="button" disabled={!sold || max < r.saMin} aria-pressed={Boolean(at)} className={chip(Boolean(at), !sold || max < r.saMin)} onClick={() => { if (!at) setIllness(r.code, start); }}>เอา</button>
                    </div>
                  </div>
                  {at && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--ct-mute)]">ทุน</span>
                      {SUMS.filter((s) => s >= r.saMin && s <= max).map((s) => (
                        <button key={s} type="button" aria-pressed={at.sumAssured === s} className={chip(at.sumAssured === s)} onClick={() => setIllness(r.code, s)}>{sumWord(s)}</button>
                      ))}
                      <input
                        id={`qv-rider-${r.code}`} aria-label={`ทุน ${r.short}`} type="text" inputMode="numeric" autoComplete="off" placeholder="พิมพ์เอง"
                        value={typed[r.code] ?? (SUMS.includes(at.sumAssured) ? "" : at.sumAssured.toLocaleString("en-US"))}
                        onFocus={() => setTyped((t) => ({ ...t, [r.code]: "" }))}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                          setTyped((t) => ({ ...t, [r.code]: digits === "" ? "" : Number(digits).toLocaleString("en-US") }));
                        }}
                        onBlur={settle}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        className="w-28 rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-1 text-center text-sm tabular-nums"
                      />
                    </div>
                  )}
                  {!sold
                    ? <p className="mt-1 text-xs text-[var(--ct-mute)]">{ages(r.ageMin, r.ageMax)}</p>
                    : max < r.saMin
                      ? <p className="mt-1 text-xs text-[var(--ct-mute)]">ทุนหลักนี้ซื้อ {r.short} ได้ไม่ถึงขั้นต่ำ {r.saMin.toLocaleString("en-US")}</p>
                      : at && at.sumAssured > max && <p className="mt-1 text-xs text-[var(--ct-accent)]">ทุน {r.short} ได้ไม่เกิน {max.toLocaleString("en-US")} ที่ทุนหลักนี้</p>}
                </div>
              );
            })}
            {group === "accident" && (
              <p className="text-xs text-[var(--ct-mute)]">
                {OCCUPATION_NOTE}
                {menu.accidentCap ? ` · ${menu.accidentCap.codes.join(" + ")} รวมกันไม่เกิน ${menu.accidentCap.multiple} เท่าของทุนหลัก` : ""}
              </p>
            )}
          </div>
        );
      })}

      {baseSum === undefined && <p className="text-xs text-[var(--ct-mute)]">งบที่ใส่รวมเบี้ยสัญญาเพิ่มเติมแล้ว ระบบหาทุนที่เบี้ยทั้งหมดไม่เกินงบ</p>}
    </div>
  );
}
