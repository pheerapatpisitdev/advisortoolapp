"use client";
import { useMemo, useState } from "react";
import {
  PA_CLASSES, PA_FAMILIES, paClassesOf, paFamily, paPerDay, paPremium, paQuoteText, paRows, paSumAfterRenewals,
  type PaFamily, type PaFamilyId, type PaPlan,
} from "@/lib/pa-plans";
import { sumWords } from "@/lib/ci123-cta";
import { Highlighted } from "@/components/Highlighted";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { Watermark } from "@/components/sales/Watermark";

/**
 * The PA calculator (owner, 2026-11-14, ก ก ก on mockup 6RyRCubLaap2YinJGpnzcm): a family, a
 * plan, the occupation class the agent picks (the brochure lists no occupations), and an age
 * that only decides whether the family can be bought. Opens on Platinum 02, class 1, age 35.
 */
const FAMILY_START: PaFamilyId = "platinum";
const PLAN_START = 1;
const AGE_START = 35;
const AGES = Array.from({ length: 65 }, (_, i) => i);

const baht = (n: number) => n.toLocaleString("en-US");

function chip(on: boolean, off = false): string {
  return `rounded-sm border px-3 py-2 text-sm leading-tight tabular-nums transition-colors ${
    off
      ? "cursor-not-allowed border-dashed border-[var(--lg-panel-line)] text-[var(--lg-mute)] opacity-45 line-through"
      : on
        ? "lg-metal-face border-[var(--lg-gold)] font-medium"
        : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
  }`;
}

/** a plan's button: the short name and the death sum, which is what the plans differ by */
function planWords(p: PaPlan): string {
  return `${p.name.replace(/^(Classic|Platinum|Max) /, "")} · ${sumWords(p.death)}`;
}

export function PACalculator({ sticky = false }: { sticky?: boolean }) {
  const [familyId, setFamilyId] = useState<PaFamilyId>(FAMILY_START);
  const [planAt, setPlanAt] = useState(PLAN_START);
  const [cls, setCls] = useState(1);
  const [age, setAge] = useState(AGE_START);

  const family = paFamily(familyId);
  const plan = family.plans[Math.min(planAt, family.plans.length - 1)];
  const premium = paPremium(plan, cls);
  const ageOk = age >= family.ageMin && age <= family.ageMax;

  const quoteText = useMemo(() => paQuoteText({ family, plan, cls, age }), [family, plan, cls, age]);

  const pickFamily = (id: PaFamilyId) => {
    setFamilyId(id);
    setPlanAt(0);
    // a class the new family never takes falls back to class 1
    if (!paClassesOf(paFamily(id)).includes(cls)) setCls(1);
  };
  const pickPlan = (i: number) => {
    setPlanAt(i);
    // Classic B does not take class 3: fall back to the highest class it does take
    const next = family.plans[i];
    if (paPremium(next, cls) === null) setCls(Math.max(...PA_CLASSES.filter((c) => paPremium(next, c) !== null)));
  };

  return (
    <div className="calc-split flex flex-col gap-6">
      <div className="calc-side contents">
        <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">แบบ</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {PA_FAMILIES.map((f) => (
                <button key={f.id} type="button" onClick={() => pickFamily(f.id)} aria-pressed={familyId === f.id} className={chip(familyId === f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--lg-mute)]">
              {family.tagline} · รับอายุ {family.ageMin === 0 ? "แรกเกิด" : family.ageMin}–{family.ageMax} ปี
            </p>
          </div>

          <div>
            <span className="block text-sm text-[var(--lg-mute)]">แผน · ทุนอุบัติเหตุ</span>
            <div className={`mt-1.5 grid gap-2 ${family.plans.length > 2 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
              {family.plans.map((p, i) => (
                <button key={p.code} type="button" onClick={() => pickPlan(i)} aria-pressed={plan.code === p.code} className={chip(plan.code === p.code)}>
                  {planWords(p)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pa-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
              <select
                id="pa-age" value={age} onChange={(e) => setAge(Number(e.target.value))}
                className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
              >
                {AGES.map((a) => <option key={a} value={a}>{a === 0 ? "ต่ำกว่า 1 ปี" : `${a} ปี`}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-sm text-[var(--lg-mute)]">ขั้นอาชีพ</span>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {PA_CLASSES.map((c) => {
                  const off = paPremium(plan, c) === null;
                  return (
                    <button
                      key={c} type="button" disabled={off} onClick={() => setCls(c)} aria-pressed={cls === c}
                      className={`${chip(cls === c, off)} !px-0 py-2.5`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="-mt-3 text-xs text-[var(--lg-mute)]">
            {plan.name} รับขั้นอาชีพ {PA_CLASSES.filter((c) => paPremium(plan, c) !== null).join(", ")}
            {" · "}ขั้น 4 ไม่รับทุกแบบ
          </p>
        </div>
        <div className="order-2">
          <ContactButtons copyText={quoteText} />
        </div>
      </div>

      {!ageOk ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          อายุ {age} ปี ซื้อ {family.name} ไม่ได้ แบบนี้รับอายุ {family.ageMin}–{family.ageMax} ปี
          {family.ageMin > 0 && <> · เด็กอายุต่ำกว่า {family.ageMin} ปี ดู PA Classic</>}
        </div>
      ) : (
        <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <div>
            <div className="text-sm text-[var(--lg-mute)]">
              เบี้ยประกัน · PA {plan.name} ({plan.code}) · ขั้นอาชีพ {cls}
            </div>
            {premium !== null && (
              <>
                <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
                  <span className="lg-metal-text">{baht(premium)}</span>
                  <span className="ml-2 text-base text-[var(--lg-mute)]">บาท ต่อปี</span>
                </div>
                <div className="mt-2.5 text-sm text-[var(--lg-mute)]">
                  <Highlighted>
                    ตกวันละ <span className="lg-figure tabular-nums">{baht(paPerDay(premium))}</span> บาท
                  </Highlighted>
                </div>
              </>
            )}
          </div>

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">ความคุ้มครองจากอุบัติเหตุ (บาท)</div>
            <dl className="mt-2 space-y-2">
              {paRows(plan).map((r) => (
                <div key={r.key} className="flex items-baseline justify-between gap-3">
                  <dt className={`text-sm ${r.key === "death" ? "text-[var(--lg-white)]" : "text-[var(--lg-mute)]"}`}>{r.label}</dt>
                  <dd className={`lg-figure shrink-0 tabular-nums ${r.key === "death" ? "text-xl text-[var(--lg-gold)]" : "text-base text-[var(--lg-white)]"}`}>
                    {baht(r.amount)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <span className="text-sm text-[var(--lg-mute)]">
                ต่ออายุปีที่ 2–6 ทุนชีวิตเพิ่มปีละ 5% · ปีที่ 6 ได้
              </span>
              <span className="lg-figure shrink-0 text-lg tabular-nums text-[var(--lg-white)]">{baht(paSumAfterRenewals(plan))}</span>
            </div>
          </div>

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            คุ้มครอง 24 ชั่วโมง ทั่วโลก · สัญญา 1 ปี ต่ออายุปีต่อปี · เบี้ยกำหนดตามลักษณะอาชีพ ไม่ขึ้นกับอายุหรือเพศ
          </p>
        </div>
      )}

      <AllPlans family={family} plan={plan} cls={cls} onPick={pickPlan} />

      {sticky && quoteText && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} compact />
        </div>
      )}
    </div>
  );
}

/**
 * Every plan of the family side by side, as the brochure prints it: navy heading, the chosen
 * plan's column marked, a premium row per class the family takes. Tapping a column picks it.
 */
function AllPlans({ family, plan, cls, onPick }: { family: PaFamily; plan: PaPlan; cls: number; onPick: (i: number) => void }) {
  const labels = paRows(family.plans[0]);
  const classes = paClassesOf(family);
  const on = (p: PaPlan) => (p.code === plan.code ? "bg-[var(--bot-navy-soft)] font-semibold text-[var(--bot-ink)]" : "");
  return (
    <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
      <div className="text-sm text-[var(--lg-mute)]">ทุกแผนใน {family.name} (บาท) · แตะคอลัมน์เพื่อเลือกแผน</div>
      <div className="mt-3 overflow-x-auto">
        <Watermark>
          <table className="w-full min-w-[34rem] border-collapse text-[12.5px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-[1] bg-[var(--bot-navy)] px-2 py-2 text-left font-semibold text-white">ความคุ้มครอง</th>
                {family.plans.map((p, i) => (
                  <th
                    key={p.code} scope="col" onClick={() => onPick(i)}
                    className={`cursor-pointer whitespace-nowrap border-l border-l-white/35 bg-[var(--bot-navy)] px-2 py-2 text-right font-semibold text-white ${
                      p.code === plan.code ? "shadow-[inset_0_-4px_0_var(--bot-highlighter)]" : ""
                    }`}
                  >
                    {p.name.replace(/^(Classic|Platinum|Max) /, "")}
                    <span className="block text-[11px] font-normal opacity-80">{p.code}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l) => (
                <tr key={l.key} className="border-t border-[var(--lg-panel-line)] text-[var(--lg-white)]">
                  <td className="sticky left-0 z-[1] min-w-[11rem] bg-[var(--lg-panel)] px-2 py-2 text-left leading-snug">{l.label}</td>
                  {family.plans.map((p, i) => (
                    <td key={p.code} onClick={() => onPick(i)} className={`cursor-pointer whitespace-nowrap px-2 py-2 text-right ${on(p)}`}>
                      {baht(paRows(p).find((r) => r.key === l.key)?.amount ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
              {classes.map((c) => (
                <tr key={c} className={`border-t border-[var(--lg-panel-line)] ${c === cls ? "text-[var(--lg-gold)]" : "text-[var(--lg-white)]"}`}>
                  <td className="sticky left-0 z-[1] bg-[var(--lg-panel)] px-2 py-2 text-left font-medium">เบี้ยรายปี ขั้นอาชีพ {c}</td>
                  {family.plans.map((p, i) => {
                    const v = paPremium(p, c);
                    return (
                      <td key={p.code} onClick={() => onPick(i)} className={`cursor-pointer whitespace-nowrap px-2 py-2 text-right font-medium ${on(p)}`}>
                        {v === null ? "—" : baht(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Watermark>
      </div>
      <p className="mt-3 text-xs text-[var(--lg-mute)] opacity-80">— แผนนี้ไม่รับขั้นอาชีพนั้น · ขั้นอาชีพ 4 ไม่รับทุกแบบ</p>
    </div>
  );
}
