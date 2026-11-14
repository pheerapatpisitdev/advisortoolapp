'use client';

import { useEffect, useMemo, useState } from 'react';
import { BracketChart } from './BracketChart';
import { Breakdown, type BreakdownRow } from './Breakdown';
import { CapBar } from './CapBar';
import { Card, Disclaimer } from './Disclaimer';
import { MoneyInput } from './MoneyInput';
import { StickyTotal } from './StickyTotal';
import { Stepper, Toggle } from './Stepper';
import { formatMoney } from '@/lib/tax/money';
import {
  defaultSocialSecurity,
  INITIAL_FORM as INITIAL,
  sanitizeForm,
  STEPS,
  STORAGE_KEY,
  toInput,
  usesSocialSecurityDefault,
  type Form,
} from '@/lib/tax/form';
import { clearState, loadState, saveState } from '@/lib/tax/storage';
import Link from 'next/link';
import { CopyButton } from '@/components/sales/CopyButton';
import { TAX_PRODUCT_LINKS, taxSummaryText } from '@/lib/tax/summary';
import { ACTIONABLE_KEYS, calculatePersonal, type PersonalInput, type PersonalResult } from '@/lib/tax/personal';
import { RULES_2569 as R } from '@/lib/tax/rules/2569';

type DKey = keyof PersonalInput['deductions'];
const DEDUCTION_GROUPS: { title: string; fields: { key: DKey; label: string; hint: string }[] }[] = [
  {
    title: 'ประกัน',
    fields: [
      { key: 'socialSecurity', label: 'ประกันสังคมที่จ่ายทั้งปี', hint: `ดูจากสลิปเงินเดือน ได้ไม่เกิน ${formatMoney(R.allowance.socialSecurity)} บาท` },
      { key: 'lifeInsurance', label: 'เบี้ยประกันชีวิต / สะสมทรัพย์', hint: `สัญญา 10 ปีขึ้นไป รวมกับประกันสุขภาพได้ไม่เกิน ${formatMoney(R.allowance.lifeHealthCombined)} บาท` },
      { key: 'healthInsurance', label: 'เบี้ยประกันสุขภาพของตัวเอง', hint: `ไม่เกิน ${formatMoney(R.allowance.health)} บาท` },
      { key: 'parentHealthInsurance', label: 'เบี้ยประกันสุขภาพพ่อแม่', hint: `พ่อแม่มีรายได้ไม่เกิน 30,000 บาท/ปี ได้ไม่เกิน ${formatMoney(R.allowance.parentHealth)} บาท` },
    ],
  },
  {
    title: 'ออมเพื่อเกษียณ',
    fields: [
      { key: 'pvd', label: 'กองทุนสำรองเลี้ยงชีพ (ส่วนที่คุณจ่าย)', hint: `ไม่เกิน ${R.allowance.pvdRate * 100}% ของรายได้` },
      { key: 'gpf', label: 'กบข. (ข้าราชการ)', hint: `ไม่เกิน ${R.allowance.gpfRate * 100}% ของรายได้` },
      { key: 'rmf', label: 'กองทุน RMF', hint: `ไม่เกิน ${R.allowance.rmfRate * 100}% ของรายได้` },
      { key: 'pensionInsurance', label: 'ประกันชีวิตแบบบำนาญ', hint: `ไม่เกิน ${R.allowance.pensionRate * 100}% ของรายได้ และ ${formatMoney(R.allowance.pensionCap)} บาท` },
      { key: 'nsf', label: 'กอช.', hint: `ไม่เกิน ${formatMoney(R.allowance.nsf)} บาท` },
    ],
  },
  {
    title: 'ลงทุน บ้าน และบริจาค',
    fields: [
      { key: 'thaiEsg', label: 'กองทุน Thai ESG / Thai ESGX', hint: `ไม่เกิน ${R.allowance.esgRate * 100}% ของรายได้ และ ${formatMoney(R.allowance.esgCap)} บาท (นับรวมสองกองทุน)` },
      { key: 'homeLoanInterest', label: 'ดอกเบี้ยเงินกู้ซื้อบ้าน', hint: `ไม่เกิน ${formatMoney(R.allowance.homeLoanInterest)} บาท` },
      { key: 'donationGeneral', label: 'เงินบริจาคทั่วไป', hint: 'วัด มูลนิธิ องค์กรการกุศล' },
      { key: 'donationDouble', label: 'บริจาคการศึกษา กีฬา โรงพยาบาลรัฐ (ผ่าน e-Donation)', hint: 'นับเป็น 2 เท่าของที่จ่าย' },
      { key: 'politicalDonation', label: 'บริจาคพรรคการเมือง', hint: `ไม่เกิน ${formatMoney(R.allowance.political)} บาท` },
    ],
  },
];


/**
 * บุคคลธรรมดา: the stand-alone tax app's five steps as they were (owner, 2026-11-15, ก on mockup
 * LxPPda9hhH7jKNkpgvRavL), with this application's two additions kept — the copied summary on
 * the last step and the way from an unused right to the plan that fills it.
 */
export function PersonalTab() {
  const [form, setForm] = useState<Form>(() => sanitizeForm(loadState(STORAGE_KEY, INITIAL)));

  useEffect(() => {
    saveState(STORAGE_KEY, form);
  }, [form]);

  const input = useMemo(() => toInput(form), [form]);
  const result = useMemo(() => calculatePersonal(input, R), [input]);
  const summary = useMemo(() => taxSummaryText(result, R), [result]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setFamily = <K extends keyof Form['family']>(k: K, v: Form['family'][K]) =>
    setForm((f) => ({ ...f, family: { ...f.family, [k]: v } }));
  const setDeduction = (k: DKey, v: number) =>
    setForm((f) => ({ ...f, deductions: { ...f.deductions, [k]: v }, ssTouched: f.ssTouched || k === 'socialSecurity' }));
  const go = (step: number) => {
    set('step', Math.max(0, Math.min(STEPS.length - 1, step)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canNext = form.step !== 0 || form.occupations.length > 0;
  const isLast = form.step === STEPS.length - 1;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ภาษีบุคคลธรรมดา ปี {R.taxYear}</h1>
        <p className="text-tx-muted">สำหรับเงินได้ 1 ม.ค.–31 ธ.ค. {R.taxYear} ที่ยื่นต้นปี {R.taxYear + 1}</p>
      </div>

      <nav aria-label="ขั้นตอน" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => go(i)}
            aria-current={form.step === i ? 'step' : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
              form.step === i ? 'bg-tx-accent font-semibold text-tx-accent-ink' : 'bg-tx-surface-2 text-tx-muted'
            }`}
          >
            <span className="num">{i + 1}.</span> {s}
          </button>
        ))}
      </nav>

      {form.step === 0 && (
        <Card title="คุณมีรายได้จากอะไรบ้างในปีนี้?">
          <p className="mb-3 text-sm text-tx-muted">เลือกได้มากกว่าหนึ่งอย่าง เช่น ทำงานประจำและขายของออนไลน์ด้วย</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {R.occupations.map((o) => {
              const on = form.occupations.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set('occupations', on ? form.occupations.filter((x) => x !== o.id) : [...form.occupations, o.id])
                  }
                  className={`rounded-xl border p-3.5 text-left transition ${
                    on ? 'border-tx-accent bg-tx-accent-soft' : 'border-tx-line bg-tx-surface hover:border-tx-muted'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-medium">{o.label}</span>
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${
                        on ? 'border-tx-accent bg-tx-accent text-tx-accent-ink' : 'border-tx-line'
                      }`}
                    >
                      {on ? '✓' : ''}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-tx-muted">{o.hint}</span>
                </button>
              );
            })}
          </div>
          {form.occupations.length === 0 && <p className="mt-3 text-sm text-tx-pay">เลือกอย่างน้อยหนึ่งอย่าง</p>}
        </Card>
      )}

      {form.step === 1 && (
        <div className="space-y-4">
          {form.occupations.includes('employee') && (
            <Card title="งานประจำ">
              <div className="space-y-4">
                <MoneyInput label="เงินเดือนต่อเดือน" hint="ก่อนหักภาษีและประกันสังคม" value={form.monthlySalary} onChange={(v) => set('monthlySalary', v)} />
                <MoneyInput label="โบนัสและเงินพิเศษทั้งปี" value={form.bonus} onChange={(v) => set('bonus', v)} />
                <Toggle
                  label="ถูกหักเงินประกันสังคม"
                  hint={
                    form.paysSocialSecurity && form.monthlySalary > 0 && !form.ssTouched
                      ? `ประมาณ ${formatMoney(defaultSocialSecurity(form.monthlySalary))} บาท/ปี นับเป็นค่าลดหย่อนให้แล้ว (ข้าราชการไม่ต้องเปิด)`
                      : 'พนักงานบริษัทส่วนใหญ่ถูกหัก ข้าราชการไม่ถูกหัก'
                  }
                  checked={form.paysSocialSecurity}
                  onChange={(b) => set('paysSocialSecurity', b)}
                />
              </div>
            </Card>
          )}
          {form.occupations
            .filter((id) => id !== 'employee')
            .map((id) => {
              const o = R.occupations.find((x) => x.id === id)!;
              const line = result.expenseLines.find((l) => l.occupation === id);
              return (
                <Card key={id} title={o.label}>
                  <div className="space-y-4">
                    <MoneyInput label="รายได้ทั้งปี" hint="ยอดที่ได้รับก่อนถูกหักภาษี ณ ที่จ่าย" value={form.amounts[id]} onChange={(v) => set('amounts', { ...form.amounts, [id]: v })}>
                      {line && line.income > 0 && (
                        <p className="num text-xs text-tx-muted">
                          หักค่าใช้จ่ายได้ {formatMoney(line.expense)} บาท ({line.note})
                        </p>
                      )}
                    </MoneyInput>
                    {o.allowActual && (
                      <>
                        <Toggle
                          label="ฉันมีหลักฐานค่าใช้จ่ายจริงมากกว่าแบบเหมา"
                          hint="เช่น ใบเสร็จค่าวัตถุดิบ ค่าเช่าร้าน ค่าจ้างลูกน้อง"
                          checked={form.useActual[id]}
                          onChange={(b) => set('useActual', { ...form.useActual, [id]: b })}
                        />
                        {form.useActual[id] && (
                          <MoneyInput label="ค่าใช้จ่ายจริงทั้งปี" hint="ใช้ตัวนี้แทนเมื่อมากกว่าแบบเหมา" value={form.actual[id]} onChange={(v) => set('actual', { ...form.actual, [id]: v })} />
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          <Card>
            <div className="space-y-4">
              <MoneyInput
                label="ภาษีที่ถูกหักไปแล้วทั้งปี (ถ้ารู้)"
                hint="ดูจากสลิปเงินเดือนเดือนธันวาคม หรือหนังสือรับรองการหักภาษี (50 ทวิ) ไม่กรอกก็ได้"
                value={form.withheld}
                onChange={(v) => set('withheld', v)}
              />
              <Toggle label="อายุ 65 ปีขึ้นไป" hint={`ได้รับยกเว้นเงินได้ ${formatMoney(R.seniorExemption)} บาทแรก`} checked={form.age65} onChange={(b) => set('age65', b)} />
            </div>
          </Card>
        </div>
      )}

      {form.step === 2 && (
        <Card title="ครอบครัว">
          <div className="divide-y divide-tx-line [&>*]:py-3">
            <Toggle label="มีคู่สมรสที่ไม่มีรายได้" hint="จดทะเบียนสมรส" checked={form.family.spouseNoIncome} onChange={(b) => setFamily('spouseNoIncome', b)} />
            <Stepper label="ลูกที่เกิดก่อนปี 2561" hint="อายุไม่เกิน 20 ปี หรือไม่เกิน 25 ปีและยังเรียนอยู่" value={form.family.childrenBefore2018} onChange={(n) => setFamily('childrenBefore2018', n)} />
            <Stepper label="ลูกที่เกิดตั้งแต่ปี 2561" hint="คนที่ 2 ขึ้นไปได้คนละ 60,000 บาท" value={form.family.childrenFrom2018} onChange={(n) => setFamily('childrenFrom2018', n)} />
            <Stepper label="พ่อแม่ที่คุณดูแล" hint="อายุ 60 ปีขึ้นไป รายได้ไม่เกิน 30,000 บาท/ปี (รวมพ่อแม่คู่สมรส)" value={form.family.parents} max={R.allowance.parentMax} onChange={(n) => setFamily('parents', n)} />
            <Stepper label="ผู้พิการหรือทุพพลภาพที่คุณอุปการะ" hint="มีบัตรคนพิการ รายได้ไม่เกิน 30,000 บาท/ปี" value={form.family.disabled} onChange={(n) => setFamily('disabled', n)} />
            <MoneyInput label="ค่าฝากครรภ์และคลอดบุตรปีนี้" hint={`ตามจ่ายจริง ไม่เกิน ${formatMoney(R.allowance.maternity)} บาทต่อการตั้งครรภ์`} value={form.family.maternity} onChange={(v) => setFamily('maternity', v)} />
          </div>
        </Card>
      )}

      {form.step === 3 && (
        <div className="space-y-4">
          {DEDUCTION_GROUPS.map((g) => (
            <Card key={g.title} title={g.title}>
              {g.title === 'ออมเพื่อเกษียณ' && (
                <p className="-mt-1 mb-3 text-sm text-tx-muted">ทั้งกลุ่มรวมกันได้ไม่เกิน {formatMoney(R.allowance.retirementGroupCap)} บาท</p>
              )}
              <div className="space-y-5">
                {g.fields.map((fd) => {
                  const line = result.deductionLines.find((l) => l.key === (fd.key === 'donationGeneral' || fd.key === 'donationDouble' ? 'donation' : fd.key));
                  const value = fd.key === 'socialSecurity' ? input.deductions.socialSecurity : form.deductions[fd.key];
                  return (
                    <MoneyInput key={fd.key} label={fd.label} hint={fd.hint} value={value} onChange={(v) => setDeduction(fd.key, v)}>
                      {line && fd.key !== 'donationGeneral' && fd.key !== 'donationDouble' && (
                        <CapBar claimed={line.claimed} allowed={line.allowed} cap={line.cap} note={line.note} />
                      )}
                      {fd.key === 'socialSecurity' && usesSocialSecurityDefault(form) && form.monthlySalary > 0 && (
                        <p className="text-xs text-tx-muted">
                          เติมให้จากเงินเดือน ({R.socialSecurityEmployee.rate * 100}% ไม่เกิน {formatMoney(R.socialSecurityEmployee.monthlyCap)} บาท/เดือน) แก้ได้
                        </p>
                      )}
                      {fd.key === 'donationDouble' && line && (
                        <CapBar claimed={line.claimed} allowed={line.allowed} cap={line.cap} note="เงินบริจาครวมนับได้ไม่เกิน 10% ของเงินได้หลังหักค่าลดหย่อนอื่น" />
                      )}
                    </MoneyInput>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {form.step === 4 && <ResultView r={result} hasEmployee={form.occupations.includes('employee')} />}

      <div className="flex gap-2">
        {form.step > 0 && (
          <button type="button" onClick={() => go(form.step - 1)} className="rounded-xl border border-tx-line bg-tx-surface px-4 py-3 font-medium">
            ย้อนกลับ
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            onClick={() => {
              clearState(STORAGE_KEY);
              setForm(INITIAL);
              window.scrollTo({ top: 0 });
            }}
            className="ml-auto rounded-xl px-4 py-3 text-sm text-tx-muted underline underline-offset-4"
          >
            ล้างข้อมูลทั้งหมด
          </button>
        ) : null}
      </div>

      <Disclaimer />

      <StickyTotal
        tax={result.tax}
        balance={result.balance}
        action={
          isLast ? (
            summary && (
              <CopyButton
                text={summary}
                words={{ full: 'คัดลอกสรุป', compact: 'คัดลอกสรุป', copied: 'คัดลอกแล้ว ✓' }}
                className="shrink-0 rounded-xl bg-tx-accent px-5 py-3 font-semibold text-tx-accent-ink"
              />
            )
          ) : (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => go(form.step + 1)}
              className="shrink-0 rounded-xl bg-tx-accent px-5 py-3 font-semibold text-tx-accent-ink disabled:opacity-40"
            >
              {form.step === STEPS.length - 2 ? 'ดูผลลัพธ์' : 'ถัดไป'}
            </button>
          )
        }
      />
    </div>
  );
}

function ResultView({ r, hasEmployee }: { r: PersonalResult; hasEmployee: boolean }) {
  const headline =
    r.tax === 0 && r.balance === 0
      ? { title: 'ไม่ต้องเสียภาษี', amount: null as number | null, tone: 'text-tx-refund', bg: 'bg-tx-accent-soft' }
      : r.balance > 0
        ? { title: 'ต้องจ่ายเพิ่มตอนยื่นแบบ', amount: r.balance, tone: 'text-tx-pay', bg: 'bg-tx-pay-soft' }
        : r.balance < 0
          ? { title: 'ได้เงินคืน', amount: -r.balance, tone: 'text-tx-refund', bg: 'bg-tx-accent-soft' }
          : { title: 'ไม่ต้องจ่ายเพิ่ม ภาษีที่ถูกหักไว้พอดีแล้ว', amount: null, tone: 'text-tx-refund', bg: 'bg-tx-accent-soft' };

  const rows: BreakdownRow[] = [
    { label: 'รายได้ทั้งปี', amount: r.totalIncome },
    ...r.expenseLines.filter((l) => l.income > 0).map((l) => ({ label: l.label, amount: l.income, indent: true })),
    { label: 'หักค่าใช้จ่าย', amount: r.totalExpenses, sign: '−' as const },
    ...r.expenseLines.filter((l) => l.expense > 0).map((l) => ({ label: l.note, amount: l.expense, indent: true })),
    ...(r.exemption > 0 ? [{ label: 'ยกเว้นผู้มีอายุ 65 ปีขึ้นไป', amount: r.exemption, sign: '−' as const }] : []),
    { label: 'หักค่าลดหย่อน', amount: r.totalDeductions, sign: '−' as const },
    ...r.deductionLines.filter((l) => l.allowed > 0).map((l) => ({ label: l.label, amount: l.allowed, indent: true })),
    { label: 'เงินได้สุทธิ (ฐานที่ใช้คิดภาษี)', amount: r.netIncome, sign: '=' as const, strong: true },
    { label: 'ภาษีทั้งปี', amount: r.tax, strong: true, note: r.methodUsed === 2 ? 'ใช้วิธีคิด 0.5% ของรายได้ เพราะสูงกว่าแบบขั้นบันได' : undefined },
    ...(r.withheld > 0 ? [{ label: 'ภาษีที่ถูกหักไปแล้ว', amount: r.withheld, sign: '−' as const }] : []),
  ];

  const save = 10000 * r.marginalRate;
  const unused = r.deductionLines.filter((l) => ACTIONABLE_KEYS.includes(l.key) && l.remaining > 0);

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl p-5 ${headline.bg}`}>
        <p className="font-medium">{headline.title}</p>
        {headline.amount !== null && (
          <p className={`num mt-1 text-4xl font-bold tracking-tight ${headline.tone}`}>
            {formatMoney(headline.amount)} <span className="text-lg font-semibold">บาท</span>
          </p>
        )}
        <p className="num mt-2 text-sm text-tx-muted">
          ภาษีทั้งปี {formatMoney(r.tax)} บาท
          {r.withheld > 0 && ` · ถูกหักไปแล้ว ${formatMoney(r.withheld)} บาท`}
          {r.totalIncome > 0 && ` · คิดเป็น ${((r.tax / r.totalIncome) * 100).toFixed(1)}% ของรายได้`}
        </p>
        {r.withheld === 0 && r.tax > 0 && hasEmployee && (
          <p className="mt-2 text-sm text-tx-muted">ถ้านายจ้างหักภาษีจากเงินเดือนไว้แล้ว กลับไปกรอกยอดที่ขั้น &ldquo;รายได้&rdquo; เพื่อดูว่าได้คืนหรือต้องจ่ายเพิ่ม</p>
        )}
      </section>

      {r.warnings.length > 0 && (
        <div className="space-y-2">
          {r.warnings.includes('halfYear') && (
            <Notice>มีรายได้ที่ต้องยื่นภาษีครึ่งปี (ภ.ง.ด.94) ช่วง ก.ค.–ก.ย. ด้วย ภาษีที่จ่ายครึ่งปีนำมาหักตอนยื่นปลายปีได้</Notice>
          )}
          {r.warnings.includes('vat') && (
            <Notice>รายได้จากการขายหรือบริการเกิน {formatMoney(R.vatThreshold)} บาทต่อปี ต้องจดทะเบียนภาษีมูลค่าเพิ่ม (VAT) ภายใน 30 วัน</Notice>
          )}
          {r.warnings.includes('method2') && (
            <Notice>
              ภาษีแบบขั้นบันไดได้ {formatMoney(r.taxMethod1)} บาท แต่วิธี 0.5% ของรายได้ที่ไม่ใช่เงินเดือนได้ {formatMoney(r.taxMethod2)} บาท กฎหมายให้จ่ายตามวิธีที่สูงกว่า
            </Notice>
          )}
        </div>
      )}

      <Card title="เงินแต่ละก้อนเสียภาษีเท่าไร">
        <p className="mb-3 text-sm text-tx-muted">ภาษีคิดแบบขั้นบันได เงินก้อนแรกไม่เสีย ก้อนถัดไปเสียเพิ่มทีละขั้น ไม่ใช่คิดเปอร์เซ็นต์เดียวทั้งก้อน</p>
        <BracketChart lines={r.bracketLines} />
      </Card>

      <Card title="ตัวเลขมาจากไหน">
        <Breakdown rows={rows} />
      </Card>

      {r.methodUsed === 2 && (
        <Card title="ลดหย่อนเพิ่มไม่ช่วยลดภาษีปีนี้">
          <p className="text-sm">
            ภาษีของคุณคิดจาก {R.method2.rate * 100}% ของรายได้ที่ไม่ใช่เงินเดือน ซึ่งไม่เกี่ยวกับค่าลดหย่อน ซื้อประกันหรือกองทุนเพิ่มจึงไม่ทำให้ภาษีปีนี้ลดลง
          </p>
        </Card>
      )}

      {r.marginalRate > 0 && r.methodUsed === 1 && (
        <Card title="ยังลดภาษีได้อีก">
          <p className="num">
            ตอนนี้เงินก้อนสุดท้ายของคุณเสียภาษี <b>{Math.round(r.marginalRate * 100)}%</b> ลดหย่อนเพิ่มทุก 10,000 บาท ประหยัดภาษีได้ประมาณ{' '}
            <b>{formatMoney(save)} บาท</b>
          </p>
          {unused.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {unused.map((l) => {
                const to = TAX_PRODUCT_LINKS[l.key];
                return (
                  <li key={l.key} className="num flex items-center justify-between gap-3">
                    <span>{l.label}</span>
                    <span className="flex shrink-0 items-center gap-2 text-tx-muted">
                      ใช้เพิ่มได้อีก {formatMoney(l.remaining)}
                      {to && (
                        <Link href={to.href} className="whitespace-nowrap rounded-full border border-tx-accent px-2.5 py-0.5 text-xs text-tx-accent no-underline">
                          {to.label} →
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-tx-muted">ลองกลับไปขั้น &ldquo;ลดหย่อน&rdquo; เพิ่มตัวเลขแล้วดูภาษีที่แถบด้านล่างเปลี่ยนทันที</p>
        </Card>
      )}

      <Card title="ต้องยื่นแบบไหม">
        {r.mustFile ? (
          <p>
            ต้องยื่นแบบ <b>{r.form}</b> ช่วง 1 ม.ค.–31 มี.ค. {R.taxYear + 1} (ยื่นออนไลน์ที่ efiling.rd.go.th มักได้ขยายเวลาเพิ่ม)
            {r.form === 'ภ.ง.ด.91' ? ' สำหรับคนที่มีแต่เงินเดือน' : ' เพราะมีรายได้อื่นนอกจากเงินเดือน'}
          </p>
        ) : (
          <p>รายได้ยังไม่ถึงเกณฑ์ที่ต้องยื่นแบบ แต่ถ้าถูกหักภาษีไว้ ยื่นแบบเพื่อขอเงินคืนได้</p>
        )}
      </Card>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-tx-warn-soft px-4 py-3 text-sm text-tx-warn-ink">{children}</p>;
}
