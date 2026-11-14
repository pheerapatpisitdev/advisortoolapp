'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Disclaimer } from './Disclaimer';
import { MoneyInput } from './MoneyInput';
import { Toggle } from './Stepper';
import { formatMoney } from '@/lib/tax/money';
import { loadState, saveState } from '@/lib/tax/storage';
import { ASSUMED_CAPITAL, comparePaths, type CompareInput } from '@/lib/tax/compare';
import { RULES_2569 as R } from '@/lib/tax/rules/2569';
import type { OccupationId } from '@/lib/tax/types';

const KEY = 'compare-2569';
const INITIAL: CompareInput = { occupation: 'merchant', revenue: 0, actualExpenses: 0, ownerSalary: 0, payDividend: true };
const CHOICES = R.occupations.filter((o) => o.id !== 'employee');

/** เทียบสองแบบ: the stand-alone tax app's own page, its colours renamed (owner, 2026-11-15, ก) */
export function CompareTab() {
  const [f, setF] = useState<CompareInput>(() => {
    const s = loadState(KEY, INITIAL);
    return CHOICES.some((c) => c.id === s.occupation) ? s : INITIAL;
  });
  useEffect(() => {
    saveState(KEY, f);
  }, [f]);

  const r = useMemo(() => comparePaths(f, R), [f]);
  const set = <K extends keyof CompareInput>(k: K, v: CompareInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const filled = f.revenue > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ทำในนามตัวเอง หรือ จดบริษัท?</h1>
        <p className="text-tx-muted">ใช้รายได้ชุดเดียวกัน คิดภาษีทั้งสองทางแล้ววางคู่กัน</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="occ" className="block text-[15px] font-medium">
              ทำอาชีพอะไร
            </label>
            <select
              id="occ"
              value={f.occupation}
              onChange={(e) => set('occupation', e.target.value as OccupationId)}
              className="w-full rounded-xl border border-tx-line bg-tx-surface px-3.5 py-3 text-base"
            >
              {CHOICES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <MoneyInput label="รายได้ทั้งปี" value={f.revenue} onChange={(v) => set('revenue', v)} />
          <MoneyInput label="ค่าใช้จ่ายจริงของกิจการทั้งปี" hint="ต้นทุนสินค้า ค่าเช่า ค่าจ้างลูกน้อง (ไม่รวมเงินที่คุณเอาไปใช้เอง)" value={f.actualExpenses} onChange={(v) => set('actualExpenses', v)} />
          <MoneyInput label="ถ้าจดบริษัท จะจ่ายเงินเดือนให้ตัวเองปีละ" hint="บริษัทนำไปหักเป็นรายจ่ายได้ แต่คุณเสียภาษีเงินเดือนแทน" value={f.ownerSalary} onChange={(v) => set('ownerSalary', v)} />
          <Toggle
            label="นำกำไรที่เหลือออกมาเป็นเงินปันผลทั้งหมด"
            hint={`ปันผลถูกหักภาษี ${R.company.dividendTax * 100}% ปิดไว้ถ้าจะเก็บกำไรไว้ในบริษัท`}
            checked={f.payDividend}
            onChange={(b) => set('payDividend', b)}
          />
        </div>
      </Card>

      {filled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="ทำในนามตัวเอง">
              <Row label="ภาษีเงินได้บุคคลธรรมดา" v={r.personal.tax} />
              <p className="mt-1 text-xs text-tx-muted">{r.personal.result.expenseLines[0]?.note}</p>
              <Total v={r.personal.tax} />
            </Card>
            <Card title="จดบริษัท">
              <Row label="ภาษีนิติบุคคล" v={r.company.corporateTax} />
              <Row label="ภาษีเงินเดือนของคุณ" v={r.company.ownerTax} />
              {r.company.ownerSalaryUsed < f.ownerSalary && (
                <p className="num text-xs text-tx-pay">
                  บริษัทจ่ายเงินเดือนได้ไม่เกินกำไร จึงคิดเงินเดือนแค่ {formatMoney(r.company.ownerSalaryUsed)} บาท
                </p>
              )}
              <Row label="ภาษีเงินปันผล" v={r.company.dividendTax} />
              <Total v={r.company.total} />
            </Card>
          </div>

          <section className="rounded-2xl bg-tx-accent-soft p-5">
            <p className="num text-lg font-semibold">
              {r.difference > 0
                ? `จดบริษัทเสียภาษีน้อยกว่า ${formatMoney(r.difference)} บาทต่อปี`
                : r.difference < 0
                  ? `ทำในนามตัวเองเสียภาษีน้อยกว่า ${formatMoney(-r.difference)} บาทต่อปี`
                  : 'ภาษีทั้งสองทางเท่ากัน'}
            </p>
            <p className="mt-1 text-sm text-tx-muted">ดูเฉพาะภาษี ยังไม่รวมค่าใช้จ่ายอื่นด้านล่าง</p>
          </section>
        </>
      )}

      <Card title="สิ่งที่ต้องคิดนอกจากภาษี">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>บริษัทต้องจ้างทำบัญชีและผู้สอบบัญชีทุกปี มักเป็นหลักหมื่นบาทขึ้นไป</li>
          <li>มีเอกสารต้องยื่นมากขึ้น ทั้งภาษีครึ่งปี งบการเงิน และภาษีหัก ณ ที่จ่าย</li>
          <li>เงินของบริษัทกับเงินส่วนตัวต้องแยกกัน จะหยิบมาใช้เองไม่ได้</li>
          <li>บริษัทจำกัดความรับผิดของผู้ถือหุ้น หนี้ของบริษัทไม่ลามถึงทรัพย์สินส่วนตัว (โดยทั่วไป)</li>
        </ul>
        <p className="mt-3 text-xs text-tx-muted">
          สมมติบริษัทมีทุนชำระแล้ว {formatMoney(ASSUMED_CAPITAL)} บาท (เข้าเกณฑ์ SME) และไม่ได้คิดประกันสังคมหรือค่าลดหย่อนอื่นของคุณ เพื่อให้สองทางเทียบกันได้ตรง ๆ
        </p>
      </Card>

      <Disclaimer />
    </div>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="num flex justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <span>{formatMoney(v)}</span>
    </div>
  );
}

function Total({ v }: { v: number }) {
  return (
    <div className="num mt-2 flex items-baseline justify-between border-t border-tx-line pt-2">
      <span className="font-semibold">รวม</span>
      <span className="text-2xl font-bold">{formatMoney(v)}</span>
    </div>
  );
}
