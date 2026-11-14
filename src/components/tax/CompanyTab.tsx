'use client';

import { useEffect, useMemo, useState } from 'react';
import { BracketChart } from './BracketChart';
import { Card, Disclaimer } from './Disclaimer';
import { MoneyInput } from './MoneyInput';
import { formatMoney } from '@/lib/tax/money';
import { loadState, saveState } from '@/lib/tax/storage';
import { calculateCompany, type CompanyInput } from '@/lib/tax/company';
import { RULES_2569 as R } from '@/lib/tax/rules/2569';

const KEY = 'company-2569';
const INITIAL: CompanyInput = { revenue: 0, expenses: 0, paidUpCapital: 1000000, taxPaid: 0 };

/** บริษัท / หจก.: the stand-alone tax app's own page, its colours renamed (owner, 2026-11-15, ก) */
export function CompanyTab() {
  const [f, setF] = useState<CompanyInput>(() => loadState(KEY, INITIAL));
  useEffect(() => {
    saveState(KEY, f);
  }, [f]);

  const r = useMemo(() => calculateCompany(f, R), [f]);
  const set = (k: keyof CompanyInput) => (v: number) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ภาษีบริษัท / ห้างหุ้นส่วน ปี {R.taxYear}</h1>
        <p className="text-tx-muted">ประมาณภาษีเงินได้นิติบุคคลทั้งปี และยอดที่ต้องจ่ายครึ่งปี</p>
      </div>

      <p className="rounded-xl bg-tx-warn-soft px-4 py-3 text-sm text-tx-warn-ink">
        <b>กำไรทางภาษีจริงต้องปรับปรุงจากงบการเงิน ตัวเลขนี้เป็นการประมาณ</b> หน้านี้คิดกำไรจากรายได้ลบรายจ่ายตรง ๆ
        ยังไม่ได้บวกกลับรายจ่ายต้องห้าม เช่น ค่ารับรองเกินเพดานหรือค่าใช้จ่ายส่วนตัว ยอดจริงให้ผู้ทำบัญชีตรวจ
      </p>

      <Card>
        <div className="space-y-4">
          <MoneyInput label="รายได้ทั้งรอบบัญชี" hint="ยอดขายและรายได้อื่นของบริษัท" value={f.revenue} onChange={set('revenue')} />
          <MoneyInput label="รายจ่ายทั้งรอบบัญชี" hint="ต้นทุน เงินเดือนพนักงาน ค่าเช่า ค่าการตลาด ฯลฯ" value={f.expenses} onChange={set('expenses')} />
          <MoneyInput label="ทุนจดทะเบียนที่ชำระแล้ว" hint="ใช้ดูว่าเข้าเกณฑ์ SME หรือไม่" value={f.paidUpCapital} onChange={set('paidUpCapital')} />
          <MoneyInput
            label="ภาษีที่จ่ายไปแล้ว (ถ้ามี)"
            hint="ภาษีครึ่งปี (ภ.ง.ด.51) และภาษีที่ลูกค้าหัก ณ ที่จ่ายไว้"
            value={f.taxPaid}
            onChange={set('taxPaid')}
          />
        </div>
      </Card>

      <section className={`rounded-2xl p-5 ${r.balance > 0 ? 'bg-tx-pay-soft' : 'bg-tx-accent-soft'}`}>
        <p className="font-medium">ภาษีนิติบุคคลทั้งปี</p>
        <p className="num mt-1 text-4xl font-bold tracking-tight">
          {formatMoney(r.tax)} <span className="text-lg font-semibold">บาท</span>
        </p>
        <p className="num mt-2 text-sm text-tx-muted">
          กำไรโดยประมาณ {formatMoney(r.profit)} บาท
          {r.profit < 0 && ' (ขาดทุน ไม่ต้องเสียภาษี)'}
          {f.taxPaid > 0 &&
            (r.balance > 0
              ? ` · ต้องจ่ายเพิ่ม ${formatMoney(r.balance)} บาท`
              : ` · ได้คืนหรือเครดิต ${formatMoney(-r.balance)} บาท`)}
        </p>
      </section>

      <Card title={r.isSme ? 'เข้าเกณฑ์ SME ได้อัตราลดหย่อน' : 'ไม่เข้าเกณฑ์ SME เสีย 20% ทั้งก้อน'}>
        <ul className="space-y-1 text-sm">
          {r.smeReasons.map((s) => (
            <li key={s} className="num">
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-tx-muted">
          SME ต้องมีทุนชำระแล้วไม่เกิน {formatMoney(R.company.smeCapital)} บาท และรายได้ไม่เกิน {formatMoney(R.company.smeRevenue)} บาท ทั้งสองข้อ
        </p>
      </Card>

      <Card title="กำไรแต่ละก้อนเสียภาษีเท่าไร">
        <BracketChart lines={r.bracketLines} unit="กำไร" />
      </Card>

      <Card title="ภาษีครึ่งปี (ภ.ง.ด.51)">
        <p className="num">
          ประมาณ <b>{formatMoney(r.halfYearTax)} บาท</b> คือครึ่งหนึ่งของภาษีที่คาดว่าจะเสียทั้งปี ยื่นภายใน 2 เดือนหลังครบ 6 เดือนแรกของรอบบัญชี
        </p>
        <p className="mt-2 text-xs text-tx-muted">
          ถ้าประมาณกำไรต่ำกว่าความจริงเกิน 25% อาจโดนเงินเพิ่ม ตัวเลขนี้คิดจากยอดทั้งปีที่กรอก
        </p>
      </Card>

      <Disclaimer />
    </div>
  );
}
