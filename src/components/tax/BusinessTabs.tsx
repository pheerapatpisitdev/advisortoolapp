"use client";
import { useEffect, useMemo, useState } from "react";
import { Highlighted } from "@/components/Highlighted";
import { calculateCompany, type CompanyInput } from "@/lib/tax/company";
import { ASSUMED_CAPITAL, comparePaths, type CompareInput } from "@/lib/tax/compare";
import { formatMoney } from "@/lib/tax/money";
import { RULES_2569 as R } from "@/lib/tax/rules/2569";
import { loadState, saveState } from "@/lib/tax/storage";
import type { OccupationId } from "@/lib/tax/types";
import { Disclaimer, Money, Notice, panel, raise, Stairs, td, th, Toggle } from "./fields";

/**
 * บริษัท / หจก. and เทียบสองแบบ (owner, 2026-11-14, ก on question 2: every mode of the
 * stand-alone app comes over). Same figures typed, same engine; the page's own layout.
 */
const COMPANY_KEY = "company-2569";
const COMPANY_START: CompanyInput = { revenue: 0, expenses: 0, paidUpCapital: 1000000, taxPaid: 0 };

export function CompanyTab() {
  const [f, setF] = useState<CompanyInput>(() => loadState(COMPANY_KEY, COMPANY_START));
  useEffect(() => { saveState(COMPANY_KEY, f); }, [f]);
  const r = useMemo(() => calculateCompany(f, R), [f]);
  const set = (k: keyof CompanyInput) => (v: number) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="calc-split flex flex-col gap-6">
      <div className="calc-side contents">
        <div className={`${panel} space-y-5`}>
          <Money label="รายได้ทั้งรอบบัญชี" hint="ยอดขายและรายได้อื่นของบริษัท" value={f.revenue} onChange={set("revenue")} />
          <Money label="รายจ่ายทั้งรอบบัญชี" hint="ต้นทุน เงินเดือนพนักงาน ค่าเช่า ค่าการตลาด ฯลฯ" value={f.expenses} onChange={set("expenses")} />
          <Money label="ทุนจดทะเบียนที่ชำระแล้ว" hint="ใช้ดูว่าเข้าเกณฑ์ SME หรือไม่" value={f.paidUpCapital} onChange={set("paidUpCapital")} />
          <Money label="ภาษีที่จ่ายไปแล้ว (ถ้ามี)" hint="ภาษีครึ่งปี (ภ.ง.ด.51) และภาษีที่ลูกค้าหัก ณ ที่จ่ายไว้" value={f.taxPaid} onChange={set("taxPaid")} />
        </div>
      </div>

      <Notice>
        <b>กำไรทางภาษีจริงต้องปรับปรุงจากงบการเงิน ตัวเลขนี้เป็นการประมาณ</b> คิดกำไรจากรายได้ลบรายจ่ายตรง ๆ
        ยังไม่ได้บวกกลับรายจ่ายต้องห้าม เช่น ค่ารับรองเกินเพดานหรือค่าใช้จ่ายส่วนตัว ยอดจริงให้ผู้ทำบัญชีตรวจ
      </Notice>

      <div className={raise}>
        <div className="text-sm text-[var(--lg-mute)]">ภาษีนิติบุคคลทั้งปี</div>
        <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
          <span className="lg-metal-text">{formatMoney(r.tax)}</span>
          <span className="ml-2 text-base text-[var(--lg-mute)]">บาท</span>
        </div>
        <div className="mt-2.5 text-sm tabular-nums text-[var(--lg-mute)]">
          กำไรโดยประมาณ {formatMoney(r.profit)} บาท{r.profit < 0 && " (ขาดทุน ไม่ต้องเสียภาษี)"} ·{" "}
          <Highlighted>{r.isSme ? "เข้าเกณฑ์ SME" : "ไม่เข้าเกณฑ์ SME เสีย 20% ทั้งก้อน"}</Highlighted>
          {f.taxPaid > 0 && (r.balance > 0 ? ` · ต้องจ่ายเพิ่ม ${formatMoney(r.balance)} บาท` : ` · ได้คืนหรือเครดิต ${formatMoney(-r.balance)} บาท`)}
        </div>
        <hr className="lg-rule my-5" />
        <div className="mb-3 text-sm text-[var(--lg-mute)]">กำไรแต่ละก้อนเสียภาษีเท่าไร</div>
        <Stairs lines={r.bracketLines} unit="กำไร" />
      </div>

      <div className={raise}>
        <div className="text-sm text-[var(--lg-mute)]">เกณฑ์ SME</div>
        <ul className="mt-2 space-y-1 text-sm tabular-nums text-[var(--lg-white)]">
          {r.smeReasons.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mt-2 text-xs text-[var(--lg-mute)]">
          SME ต้องมีทุนชำระแล้วไม่เกิน {formatMoney(R.company.smeCapital)} บาท และรายได้ไม่เกิน {formatMoney(R.company.smeRevenue)} บาท ทั้งสองข้อ
        </p>
      </div>

      <div className={raise}>
        <div className="text-sm text-[var(--lg-mute)]">ภาษีครึ่งปี (ภ.ง.ด.51)</div>
        <div className="lg-figure mt-1 text-2xl tabular-nums text-[var(--lg-white)]">
          {formatMoney(r.halfYearTax)} <span className="text-sm text-[var(--lg-mute)]">บาท</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--lg-mute)]">
          ครึ่งหนึ่งของภาษีที่คาดว่าจะเสียทั้งปี ยื่นภายใน 2 เดือนหลังครบ 6 เดือนแรกของรอบบัญชี
          ถ้าประมาณกำไรต่ำกว่าความจริงเกิน 25% อาจโดนเงินเพิ่ม
        </p>
      </div>
      <Disclaimer />
    </div>
  );
}

const COMPARE_KEY = "compare-2569";
const COMPARE_START: CompareInput = { occupation: "merchant", revenue: 0, actualExpenses: 0, ownerSalary: 0, payDividend: true };
const CHOICES = R.occupations.filter((o) => o.id !== "employee");

export function CompareTab() {
  const [f, setF] = useState<CompareInput>(() => {
    const s = loadState(COMPARE_KEY, COMPARE_START);
    return CHOICES.some((c) => c.id === s.occupation) ? s : COMPARE_START;
  });
  useEffect(() => { saveState(COMPARE_KEY, f); }, [f]);
  const r = useMemo(() => comparePaths(f, R), [f]);
  const set = <K extends keyof CompareInput>(k: K, v: CompareInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const cell = `${td} whitespace-nowrap text-right`;

  return (
    <div className="calc-split flex flex-col gap-6">
      <div className="calc-side contents">
        <div className={`${panel} space-y-5`}>
          <div>
            <label htmlFor="tax-occ" className="block text-sm text-[var(--lg-mute)]">ทำอาชีพอะไร</label>
            <select
              id="tax-occ" value={f.occupation} onChange={(e) => set("occupation", e.target.value as OccupationId)}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-[var(--lg-white)]"
            >
              {CHOICES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <Money label="รายได้ทั้งปี" value={f.revenue} onChange={(v) => set("revenue", v)} />
          <Money label="ค่าใช้จ่ายจริงของกิจการทั้งปี" hint="ต้นทุนสินค้า ค่าเช่า ค่าจ้างลูกน้อง (ไม่รวมเงินที่เอาไปใช้เอง)" value={f.actualExpenses} onChange={(v) => set("actualExpenses", v)} />
          <Money label="ถ้าจดบริษัท จ่ายเงินเดือนให้ตัวเองปีละ" hint="บริษัทนำไปหักเป็นรายจ่ายได้ แต่เจ้าของเสียภาษีเงินเดือนแทน" value={f.ownerSalary} onChange={(v) => set("ownerSalary", v)} />
          <Toggle
            label="นำกำไรที่เหลือออกมาเป็นเงินปันผลทั้งหมด" hint={`ปันผลถูกหักภาษี ${R.company.dividendTax * 100}% ปิดไว้ถ้าจะเก็บกำไรไว้ในบริษัท`}
            checked={f.payDividend} onChange={(b) => set("payDividend", b)}
          />
        </div>
      </div>

      {f.revenue > 0 ? (
        <>
          <div className="overflow-x-auto rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)]">
            <table className="w-full min-w-[26rem] border-collapse text-[13px] tabular-nums text-[var(--lg-white)]">
              <thead>
                <tr>
                  <th scope="col" className={`${th} text-left`}>ภาษีต่อปี (บาท)</th>
                  <th scope="col" className={`${th} border-l border-l-white/35 text-right`}>ทำในนามตัวเอง</th>
                  <th scope="col" className={`${th} border-l border-l-white/35 text-right`}>จดบริษัท</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className={td}>ภาษีเงินได้บุคคลธรรมดา</td><td className={cell}>{formatMoney(r.personal.tax)}</td><td className={cell}>{formatMoney(r.company.ownerTax)}</td></tr>
                <tr><td className={td}>ภาษีนิติบุคคล</td><td className={cell}>–</td><td className={cell}>{formatMoney(r.company.corporateTax)}</td></tr>
                <tr><td className={td}>ภาษีเงินปันผล {R.company.dividendTax * 100}%</td><td className={cell}>–</td><td className={cell}>{formatMoney(r.company.dividendTax)}</td></tr>
                <tr className="bg-[var(--bot-navy-soft)] font-semibold text-[var(--bot-ink)]">
                  <td className={td}>รวม</td><td className={cell}>{formatMoney(r.personal.tax)}</td><td className={cell}>{formatMoney(r.company.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {r.personal.result.expenseLines[0] && (
            <p className="-mt-3 text-xs text-[var(--lg-mute)]">ในนามตัวเอง: {r.personal.result.expenseLines[0].note}</p>
          )}
          {r.company.ownerSalaryUsed < f.ownerSalary && (
            <Notice>บริษัทจ่ายเงินเดือนได้ไม่เกินกำไร จึงคิดเงินเดือนแค่ {formatMoney(r.company.ownerSalaryUsed)} บาท</Notice>
          )}
          <div className={raise}>
            <p className="lg-figure text-xl tabular-nums text-[var(--lg-white)]">
              <Highlighted>
                {r.difference > 0
                  ? `จดบริษัทเสียภาษีน้อยกว่า ${formatMoney(r.difference)} บาทต่อปี`
                  : r.difference < 0
                    ? `ทำในนามตัวเองเสียภาษีน้อยกว่า ${formatMoney(-r.difference)} บาทต่อปี`
                    : "ภาษีทั้งสองทางเท่ากัน"}
              </Highlighted>
            </p>
            <p className="mt-2 text-xs text-[var(--lg-mute)]">ดูเฉพาะภาษี ยังไม่รวมค่าใช้จ่ายอื่นด้านล่าง</p>
          </div>
        </>
      ) : (
        <div className={`${raise} py-10 text-center text-sm leading-relaxed text-[var(--lg-mute)]`}>
          กรอกรายได้ทั้งปี แล้วภาษีของสองทางจะวางคู่กันตรงนี้
        </div>
      )}

      <div className={raise}>
        <div className="text-sm text-[var(--lg-mute)]">สิ่งที่ต้องคิดนอกจากภาษี</div>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--lg-white)]">
          <li>บริษัทต้องจ้างทำบัญชีและผู้สอบบัญชีทุกปี มักเป็นหลักหมื่นบาทขึ้นไป</li>
          <li>มีเอกสารต้องยื่นมากขึ้น ทั้งภาษีครึ่งปี งบการเงิน และภาษีหัก ณ ที่จ่าย</li>
          <li>เงินของบริษัทกับเงินส่วนตัวต้องแยกกัน จะหยิบมาใช้เองไม่ได้</li>
          <li>บริษัทจำกัดความรับผิดของผู้ถือหุ้น หนี้ของบริษัทไม่ลามถึงทรัพย์สินส่วนตัว (โดยทั่วไป)</li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[var(--lg-mute)]">
          สมมติบริษัทมีทุนชำระแล้ว {formatMoney(ASSUMED_CAPITAL)} บาท (เข้าเกณฑ์ SME) และไม่ได้คิดประกันสังคมหรือค่าลดหย่อนอื่นของเจ้าของ เพื่อให้สองทางเทียบกันได้ตรง ๆ
        </p>
      </div>
      <Disclaimer />
    </div>
  );
}
