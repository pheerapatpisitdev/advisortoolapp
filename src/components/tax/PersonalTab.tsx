"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Highlighted } from "@/components/Highlighted";
import { CopyButton } from "@/components/sales/CopyButton";
import { formatMoney } from "@/lib/tax/money";
import {
  defaultSocialSecurity, INITIAL_FORM, sanitizeForm, STORAGE_KEY, toInput, usesSocialSecurityDefault, type Form,
} from "@/lib/tax/form";
import { calculatePersonal, type PersonalInput, type PersonalResult } from "@/lib/tax/personal";
import { RULES_2569 as R } from "@/lib/tax/rules/2569";
import { clearState, loadState, saveState } from "@/lib/tax/storage";
import { savingPer10k, TAX_PRODUCT_LINKS, taxHeadline, taxSummaryText, unusedRights } from "@/lib/tax/summary";
import { CapBar, chip, Disclaimer, Group, Money, Notice, panel, raise, Stairs, Stepper, td, th, Toggle } from "./fields";

/**
 * บุคคลธรรมดา (owner, 2026-11-14, ก on question 1): the stand-alone app's five steps on one
 * page — the figures typed on the left, the tax live on the right — as every calculator here
 * is laid out. What is typed stays in this browser, as it did there.
 */
type DKey = keyof PersonalInput["deductions"];
type Field = { key: DKey; label: string; hint: string };
const a = R.allowance;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const INSURANCE: Field[] = [
  { key: "socialSecurity", label: "ประกันสังคมที่จ่ายทั้งปี", hint: `ดูจากสลิปเงินเดือน ได้ไม่เกิน ${formatMoney(a.socialSecurity)} บาท` },
  { key: "lifeInsurance", label: "เบี้ยประกันชีวิต / สะสมทรัพย์", hint: `สัญญา 10 ปีขึ้นไป รวมกับประกันสุขภาพได้ไม่เกิน ${formatMoney(a.lifeHealthCombined)} บาท` },
  { key: "healthInsurance", label: "เบี้ยประกันสุขภาพของตัวเอง", hint: `ไม่เกิน ${formatMoney(a.health)} บาท` },
  { key: "parentHealthInsurance", label: "เบี้ยประกันสุขภาพพ่อแม่", hint: `พ่อแม่มีรายได้ไม่เกิน 30,000 บาท/ปี ได้ไม่เกิน ${formatMoney(a.parentHealth)} บาท` },
];
const RETIRE: Field[] = [
  { key: "pvd", label: "กองทุนสำรองเลี้ยงชีพ (ส่วนที่จ่ายเอง)", hint: `ไม่เกิน ${pct(a.pvdRate)} ของรายได้` },
  { key: "gpf", label: "กบข. (ข้าราชการ)", hint: `ไม่เกิน ${pct(a.gpfRate)} ของรายได้` },
  { key: "rmf", label: "กองทุน RMF", hint: `ไม่เกิน ${pct(a.rmfRate)} ของรายได้` },
  { key: "pensionInsurance", label: "ประกันชีวิตแบบบำนาญ", hint: `ไม่เกิน ${pct(a.pensionRate)} ของรายได้ และ ${formatMoney(a.pensionCap)} บาท` },
  { key: "nsf", label: "กอช.", hint: `ไม่เกิน ${formatMoney(a.nsf)} บาท` },
];
const OTHER: Field[] = [
  { key: "thaiEsg", label: "กองทุน Thai ESG / Thai ESGX", hint: `ไม่เกิน ${pct(a.esgRate)} ของรายได้ และ ${formatMoney(a.esgCap)} บาท (นับรวมสองกองทุน)` },
  { key: "homeLoanInterest", label: "ดอกเบี้ยเงินกู้ซื้อบ้าน", hint: `ไม่เกิน ${formatMoney(a.homeLoanInterest)} บาท` },
  { key: "donationGeneral", label: "เงินบริจาคทั่วไป", hint: "วัด มูลนิธิ องค์กรการกุศล" },
  { key: "donationDouble", label: "บริจาคการศึกษา กีฬา โรงพยาบาลรัฐ (e-Donation)", hint: "นับเป็น 2 เท่าของที่จ่าย" },
  { key: "politicalDonation", label: "บริจาคพรรคการเมือง", hint: `ไม่เกิน ${formatMoney(a.political)} บาท` },
];

/** a fold's heading: what has been typed into it */
const filled = (n: number) => (n > 0 ? formatMoney(n) : "ยังไม่ได้กรอก");

export function PersonalTab() {
  const [form, setForm] = useState<Form>(() => sanitizeForm(loadState(STORAGE_KEY, INITIAL_FORM)));
  useEffect(() => { saveState(STORAGE_KEY, form); }, [form]);

  const input = useMemo(() => toInput(form), [form]);
  const r = useMemo(() => calculatePersonal(input, R), [input]);
  const text = useMemo(() => taxSummaryText(r, R), [r]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setFamily = <K extends keyof Form["family"]>(k: K, v: Form["family"][K]) => setForm((f) => ({ ...f, family: { ...f.family, [k]: v } }));
  const setDeduction = (k: DKey, v: number) =>
    setForm((f) => ({ ...f, deductions: { ...f.deductions, [k]: v }, ssTouched: f.ssTouched || k === "socialSecurity" }));
  const clear = () => { clearState(STORAGE_KEY); setForm(INITIAL_FORM); };

  const employee = form.occupations.includes("employee");
  const fam = form.family;
  const familyCount = Number(fam.spouseNoIncome) + fam.childrenBefore2018 + fam.childrenFrom2018 + fam.parents + fam.disabled + Number(fam.maternity > 0);
  const sumOf = (fields: Field[]) => fields.reduce((s, f) => s + input.deductions[f.key], 0);

  const field = (fd: Field) => {
    const donation = fd.key === "donationGeneral" || fd.key === "donationDouble";
    const line = r.deductionLines.find((l) => l.key === (donation ? "donation" : fd.key));
    const value = fd.key === "socialSecurity" ? input.deductions.socialSecurity : form.deductions[fd.key];
    return (
      <Money key={fd.key} label={fd.label} hint={fd.hint} value={value} onChange={(v) => setDeduction(fd.key, v)}>
        {line && !donation && <CapBar claimed={line.claimed} allowed={line.allowed} cap={line.cap} note={line.note} />}
        {fd.key === "socialSecurity" && usesSocialSecurityDefault(form) && form.monthlySalary > 0 && (
          <p className="mt-1 text-xs text-[var(--lg-mute)]">
            เติมให้จากเงินเดือน ({R.socialSecurityEmployee.rate * 100}% ไม่เกิน {formatMoney(R.socialSecurityEmployee.monthlyCap)} บาท/เดือน) แก้ได้
          </p>
        )}
        {fd.key === "donationDouble" && line && (
          <CapBar claimed={line.claimed} allowed={line.allowed} cap={line.cap} note="เงินบริจาครวมนับได้ไม่เกิน 10% ของเงินได้หลังหักค่าลดหย่อนอื่น" />
        )}
      </Money>
    );
  };

  return (
    <div className="calc-split flex flex-col gap-6">
      <div className="calc-side contents">
        <div className={`${panel} space-y-5`}>
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">รายได้มาจากอะไร (เลือกได้หลายอย่าง)</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {R.occupations.map((o) => {
                const on = form.occupations.includes(o.id);
                return (
                  <button
                    key={o.id} type="button" aria-pressed={on} title={o.hint}
                    onClick={() => set("occupations", on ? form.occupations.filter((x) => x !== o.id) : [...form.occupations, o.id])}
                    className={`${chip(on)} !text-[0.8rem]`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {form.occupations.length === 0 && <p className="mt-2 text-xs text-[var(--bot-red-ink)]">เลือกอย่างน้อยหนึ่งอย่าง</p>}
          </div>

          {employee && (
            <>
              <Money label="เงินเดือนต่อเดือน" hint="ก่อนหักภาษีและประกันสังคม" value={form.monthlySalary} onChange={(v) => set("monthlySalary", v)} />
              <Money label="โบนัสและเงินพิเศษทั้งปี" value={form.bonus} onChange={(v) => set("bonus", v)} />
              <Toggle
                label="ถูกหักเงินประกันสังคม"
                hint={
                  form.paysSocialSecurity && form.monthlySalary > 0 && !form.ssTouched
                    ? `ประมาณ ${formatMoney(defaultSocialSecurity(form.monthlySalary))} บาท/ปี นับเป็นค่าลดหย่อนให้แล้ว`
                    : "พนักงานบริษัทส่วนใหญ่ถูกหัก ข้าราชการไม่ถูกหัก"
                }
                checked={form.paysSocialSecurity} onChange={(b) => set("paysSocialSecurity", b)}
              />
            </>
          )}

          {form.occupations.filter((id) => id !== "employee").map((id) => {
            const o = R.occupations.find((x) => x.id === id)!;
            const line = r.expenseLines.find((l) => l.occupation === id);
            return (
              <div key={id} className="space-y-4 border-t border-[var(--lg-panel-line)] pt-4">
                <Money label={`รายได้ทั้งปี · ${o.label}`} hint="ยอดที่ได้รับก่อนถูกหักภาษี ณ ที่จ่าย" value={form.amounts[id]} onChange={(v) => set("amounts", { ...form.amounts, [id]: v })}>
                  {line && line.income > 0 && (
                    <p className="mt-1 text-xs tabular-nums text-[var(--lg-mute)]">หักค่าใช้จ่ายได้ {formatMoney(line.expense)} บาท ({line.note})</p>
                  )}
                </Money>
                {o.allowActual && (
                  <>
                    <Toggle
                      label="มีหลักฐานค่าใช้จ่ายจริงมากกว่าแบบเหมา" hint="เช่น ใบเสร็จค่าวัตถุดิบ ค่าเช่าร้าน ค่าจ้างลูกน้อง"
                      checked={form.useActual[id]} onChange={(b) => set("useActual", { ...form.useActual, [id]: b })}
                    />
                    {form.useActual[id] && (
                      <Money label="ค่าใช้จ่ายจริงทั้งปี" hint="ใช้ตัวนี้แทนเมื่อมากกว่าแบบเหมา" value={form.actual[id]} onChange={(v) => set("actual", { ...form.actual, [id]: v })} />
                    )}
                  </>
                )}
              </div>
            );
          })}

          <Money label="ภาษีที่ถูกหักไปแล้วทั้งปี (ถ้ารู้)" hint="ดูจากหนังสือรับรองการหักภาษี (50 ทวิ) ไม่กรอกก็ได้" value={form.withheld} onChange={(v) => set("withheld", v)} />
          <Toggle label="อายุ 65 ปีขึ้นไป" hint={`ได้รับยกเว้นเงินได้ ${formatMoney(R.seniorExemption)} บาทแรก`} checked={form.age65} onChange={(b) => set("age65", b)} />

          <Group title="ครอบครัว" filled={familyCount > 0 ? `${familyCount} รายการ` : "ยังไม่ได้กรอก"}>
            <Toggle label="มีคู่สมรสที่ไม่มีรายได้" hint="จดทะเบียนสมรส" checked={fam.spouseNoIncome} onChange={(b) => setFamily("spouseNoIncome", b)} />
            <Stepper label="ลูกที่เกิดก่อนปี 2561" hint="อายุไม่เกิน 20 ปี หรือไม่เกิน 25 ปีและยังเรียนอยู่" value={fam.childrenBefore2018} onChange={(n) => setFamily("childrenBefore2018", n)} />
            <Stepper label="ลูกที่เกิดตั้งแต่ปี 2561" hint="คนที่ 2 ขึ้นไปได้คนละ 60,000 บาท" value={fam.childrenFrom2018} onChange={(n) => setFamily("childrenFrom2018", n)} />
            <Stepper label="พ่อแม่ที่ดูแล" hint="อายุ 60 ปีขึ้นไป รายได้ไม่เกิน 30,000 บาท/ปี (รวมพ่อแม่คู่สมรส)" value={fam.parents} max={a.parentMax} onChange={(n) => setFamily("parents", n)} />
            <Stepper label="ผู้พิการที่อุปการะ" hint="มีบัตรคนพิการ รายได้ไม่เกิน 30,000 บาท/ปี" value={fam.disabled} onChange={(n) => setFamily("disabled", n)} />
            <Money label="ค่าฝากครรภ์และคลอดบุตรปีนี้" hint={`ตามจ่ายจริง ไม่เกิน ${formatMoney(a.maternity)} บาทต่อการตั้งครรภ์`} value={fam.maternity} onChange={(v) => setFamily("maternity", v)} />
          </Group>
          <Group title="ประกัน" filled={filled(sumOf(INSURANCE))} open>
            {INSURANCE.map(field)}
          </Group>
          <Group title="ออมเพื่อเกษียณ" filled={filled(sumOf(RETIRE))}>
            <p className="text-xs text-[var(--lg-mute)]">ทั้งกลุ่มรวมกันได้ไม่เกิน {formatMoney(a.retirementGroupCap)} บาท</p>
            {RETIRE.map(field)}
          </Group>
          <Group title="ลงทุน บ้าน บริจาค" filled={filled(sumOf(OTHER))}>
            {OTHER.map(field)}
          </Group>
        </div>

        <div className="order-2 grid grid-cols-2 gap-2">
          {text
            ? <CopyButton text={text} words={{ full: "คัดลอกสรุป", compact: "คัดลอกสรุป", copied: "คัดลอกแล้ว ✓" }} className="rounded-sm bg-[var(--lg-gold)] px-3 py-3 text-center text-sm font-medium text-[var(--lg-ground)]" />
            : <span className="rounded-sm bg-[var(--lg-gold)] px-3 py-3 text-center text-sm font-medium text-[var(--lg-ground)] opacity-40">คัดลอกสรุป</span>}
          <button type="button" onClick={clear} className="rounded-sm border border-[var(--lg-panel-line)] px-3 py-3 text-center text-sm text-[var(--lg-mute)]">
            ล้างข้อมูล
          </button>
        </div>
      </div>

      <Result r={r} employee={employee} />

      {text && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 px-4 py-2.5 backdrop-blur sm:hidden">
          <p className="min-w-0 flex-1 text-xs leading-tight text-[var(--lg-mute)]">
            ภาษีทั้งปีโดยประมาณ
            <span className="block text-lg font-medium tabular-nums text-[var(--lg-white)]">{formatMoney(r.tax)} บาท</span>
          </p>
          <CopyButton text={text} compact words={{ full: "คัดลอกสรุป", compact: "คัดลอกสรุป", copied: "คัดลอกแล้ว ✓" }} className="shrink-0 rounded-sm bg-[var(--lg-gold)] px-4 py-2.5 text-sm font-medium text-[var(--lg-ground)]" />
        </div>
      )}
    </div>
  );
}

function Result({ r, employee }: { r: PersonalResult; employee: boolean }) {
  const h = taxHeadline(r);
  const unused = unusedRights(r);
  if (r.totalIncome <= 0) {
    return (
      <>
        <div className={`${raise} py-10 text-center text-sm leading-relaxed text-[var(--lg-mute)]`}>
          กรอกรายได้ แล้วภาษีทั้งปีจะขึ้นตรงนี้ทันที พร้อมที่มาของทุกตัวเลขและสิทธิ์ลดหย่อนที่ยังเหลือ
        </div>
        <Disclaimer />
      </>
    );
  }
  return (
    <>
      <div className={raise}>
        <div className="text-sm text-[var(--lg-mute)]">{h.title}</div>
        {h.amount !== null && (
          <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
            <span className={h.tone === "pay" ? "lg-metal-text" : "text-[var(--lg-gain)]"}>{formatMoney(h.amount)}</span>
            <span className="ml-2 text-base text-[var(--lg-mute)]">บาท</span>
          </div>
        )}
        <div className="mt-2.5 text-sm tabular-nums text-[var(--lg-mute)]">
          <Highlighted>ภาษีทั้งปี <span className="lg-figure">{formatMoney(r.tax)}</span> บาท</Highlighted>
          {r.withheld > 0 && ` · ถูกหักไปแล้ว ${formatMoney(r.withheld)}`}
          {` · คิดเป็น ${((r.tax / r.totalIncome) * 100).toFixed(1)}% ของรายได้`}
        </div>
        {r.withheld === 0 && r.tax > 0 && employee && (
          <p className="mt-2 text-xs text-[var(--lg-mute)]">ถ้านายจ้างหักภาษีจากเงินเดือนไว้แล้ว กรอกยอดที่ “ภาษีที่ถูกหักไปแล้ว” เพื่อดูว่าได้คืนหรือต้องจ่ายเพิ่ม</p>
        )}
        <hr className="lg-rule my-5" />
        <div className="mb-3 text-sm text-[var(--lg-mute)]">เงินแต่ละก้อนเสียภาษีเท่าไร</div>
        <Stairs lines={r.bracketLines} />
      </div>

      {r.warnings.includes("method2") && (
        <Notice>
          ภาษีแบบขั้นบันไดได้ {formatMoney(r.taxMethod1)} บาท แต่วิธี {R.method2.rate * 100}% ของรายได้ที่ไม่ใช่เงินเดือนได้ {formatMoney(r.taxMethod2)} บาท กฎหมายให้จ่ายตามวิธีที่สูงกว่า
          ลดหย่อนเพิ่มจึงไม่ทำให้ภาษีปีนี้ลดลง
        </Notice>
      )}
      {r.warnings.includes("halfYear") && (
        <Notice>มีรายได้ที่ต้องยื่นภาษีครึ่งปี (ภ.ง.ด.94) ช่วง ก.ค.–ก.ย. ด้วย ภาษีที่จ่ายครึ่งปีนำมาหักตอนยื่นปลายปีได้</Notice>
      )}
      {r.warnings.includes("vat") && (
        <Notice>รายได้จากการขายหรือบริการเกิน {formatMoney(R.vatThreshold)} บาทต่อปี ต้องจดทะเบียนภาษีมูลค่าเพิ่ม (VAT) ภายใน 30 วัน</Notice>
      )}

      {r.marginalRate > 0 && r.methodUsed === 1 && (
        <div className={raise}>
          <div className="text-sm text-[var(--lg-mute)]">ยังลดภาษีได้อีก</div>
          <p className="mt-1 text-sm tabular-nums text-[var(--lg-white)]">
            เงินก้อนสุดท้ายเสียภาษี {Math.round(r.marginalRate * 100)}% ลดหย่อนเพิ่มทุก 10,000 บาท ประหยัดได้{" "}
            <Highlighted><span className="lg-figure">{formatMoney(savingPer10k(r))}</span> บาท</Highlighted>
          </p>
          {unused.length > 0 && (
            <ul className="mt-3">
              {unused.map((l) => {
                const to = TAX_PRODUCT_LINKS[l.key];
                return (
                  <li key={l.key} className="flex items-center justify-between gap-3 border-b border-[var(--lg-hair)] py-2 text-sm last:border-b-0">
                    <span className="tabular-nums text-[var(--lg-white)]">
                      {l.label} <span className="text-[var(--lg-mute)]">เหลือ {formatMoney(l.remaining)}</span>
                    </span>
                    {to && (
                      <Link href={to.href} className="shrink-0 whitespace-nowrap rounded-sm border border-[var(--lg-gold)] px-2.5 py-1 text-xs text-[var(--lg-gold)] no-underline">
                        {to.label} →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)]">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr><th scope="col" className={`${th} text-left`}>ตัวเลขมาจากไหน</th><th scope="col" className={`${th} text-right`}>บาท</th></tr>
          </thead>
          <tbody>
            <Row label="รายได้ทั้งปี" v={r.totalIncome} />
            {r.expenseLines.length > 1 && r.expenseLines.filter((l) => l.income > 0).map((l) => <Row key={`i${l.occupation}`} label={l.label} v={l.income} sub />)}
            <Row label="หักค่าใช้จ่าย" v={r.totalExpenses} minus />
            {r.expenseLines.filter((l) => l.expense > 0).map((l) => <Row key={`e${l.occupation}`} label={l.note} v={l.expense} sub />)}
            {r.exemption > 0 && <Row label="ยกเว้นผู้มีอายุ 65 ปีขึ้นไป" v={r.exemption} minus />}
            <Row label="หักค่าลดหย่อน" v={r.totalDeductions} minus />
            {r.deductionLines.filter((l) => l.allowed > 0).map((l) => <Row key={l.key} label={l.label} v={l.allowed} sub />)}
            <Row label="เงินได้สุทธิ (ฐานที่ใช้คิดภาษี)" v={r.netIncome} sum />
            <Row label={r.methodUsed === 2 ? `ภาษีทั้งปี (วิธี ${R.method2.rate * 100}% ของรายได้)` : "ภาษีทั้งปี"} v={r.tax} sum />
            {r.withheld > 0 && <Row label="ภาษีที่ถูกหักไปแล้ว" v={r.withheld} minus />}
          </tbody>
        </table>
      </div>

      <Notice>
        {r.mustFile
          ? <>ต้องยื่นแบบ <b>{r.form}</b> ช่วง 1 ม.ค.–31 มี.ค. {R.taxYear + 1}{r.form === "ภ.ง.ด.91" ? " สำหรับคนที่มีแต่เงินเดือน" : " เพราะมีรายได้อื่นนอกจากเงินเดือน"}</>
          : <>รายได้ยังไม่ถึงเกณฑ์ที่ต้องยื่นแบบ แต่ถ้าถูกหักภาษีไว้ ยื่นแบบเพื่อขอเงินคืนได้</>}
      </Notice>
      <Disclaimer />
    </>
  );
}

function Row({ label, v, minus = false, sub = false, sum = false }: { label: string; v: number; minus?: boolean; sub?: boolean; sum?: boolean }) {
  const tone = sum ? "bg-[var(--bot-navy-soft)] font-semibold text-[var(--bot-ink)]" : sub ? "text-[var(--lg-mute)]" : "text-[var(--lg-white)]";
  return (
    <tr className={tone}>
      <td className={`${td} ${sub ? "pl-7" : ""}`}>{label}</td>
      <td className={`${td} whitespace-nowrap text-right`}>{minus ? "− " : ""}{formatMoney(v)}</td>
    </tr>
  );
}
