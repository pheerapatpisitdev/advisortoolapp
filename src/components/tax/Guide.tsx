import { Card, Disclaimer } from './Disclaimer';
import { formatMoney } from '@/lib/tax/money';
import { RULES_2569 as R } from '@/lib/tax/rules/2569';

const a = R.allowance;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** คู่มือ: the stand-alone tax app's guide, every figure read from the rules file */
export function Guide() {
  return (
    <article className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">คู่มือภาษีปี {R.taxYear} แบบภาษาคน</h1>
        <p className="text-tx-muted">อ่าน 5 นาที เข้าใจว่าหน้านี้คิดภาษีอย่างไร</p>
      </div>

      <Card title="1. ภาษีคิดอย่างไร (สรุปใน 4 บรรทัด)">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>รวม<b>รายได้ทั้งปี</b> (1 ม.ค.–31 ธ.ค.)</li>
          <li>
            หัก<b>ค่าใช้จ่าย</b> ตามอาชีพ เช่น เงินเดือนหัก 50% ไม่เกิน {formatMoney(R.sharedExpenseCap)} บาท ค้าขายหักเหมา 60%
          </li>
          <li>
            หัก<b>ค่าลดหย่อน</b> เช่น ส่วนตัว {formatMoney(a.self)} บาท ประกัน กองทุน → ได้ &ldquo;เงินได้สุทธิ&rdquo;
          </li>
          <li>
            นำเงินได้สุทธิไปคิด<b>ภาษีขั้นบันได</b> แล้วหักภาษีที่ถูกหักไปแล้ว → รู้ว่าต้องจ่ายเพิ่มหรือได้คืน
          </li>
        </ol>
      </Card>

      <Card title="2. ขั้นบันไดคืออะไร">
        <p className="mb-3 text-sm text-tx-muted">
          เงินได้สุทธิถูกแบ่งเป็นก้อน ก้อนแรกไม่เสีย ก้อนถัดไปเสียแพงขึ้นทีละขั้น ขึ้นขั้นใหม่ไม่ได้ทำให้เงินก้อนก่อนหน้าเสียแพงขึ้น
        </p>
        <table className="num w-full text-sm">
          <thead>
            <tr className="border-b border-tx-line text-left text-tx-muted">
              <th className="py-1.5 font-medium">เงินได้สุทธิ (บาท)</th>
              <th className="py-1.5 text-right font-medium">อัตรา</th>
            </tr>
          </thead>
          <tbody>
            {R.personalBrackets.map((b, i) => {
              const from = i === 0 ? 0 : (R.personalBrackets[i - 1].upTo ?? 0) + 1;
              return (
                <tr key={i} className="border-b border-tx-line last:border-0">
                  <td className="py-1.5">
                    {formatMoney(from)} – {b.upTo === null ? 'ขึ้นไป' : formatMoney(b.upTo)}
                  </td>
                  <td className="py-1.5 text-right">{b.rate === 0 ? 'ยกเว้น' : pct(b.rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-tx-muted">
          ถ้ามีรายได้ที่ไม่ใช่เงินเดือนตั้งแต่ {formatMoney(R.method2.threshold)} บาท ต้องคิดอีกวิธีคือ {R.method2.rate * 100}% ของรายได้นั้น
          (ถ้าไม่เกิน {formatMoney(R.method2.waiveUpTo)} บาทได้ยกเว้น) แล้วจ่ายตามวิธีที่สูงกว่า หน้านี้คิดให้อัตโนมัติ
        </p>
      </Card>

      <Card title="3. ค่าลดหย่อนแต่ละกลุ่ม">
        <dl className="space-y-3 text-sm">
          <Group title="ตัวเองและครอบครัว">
            ส่วนตัว {formatMoney(a.self)} · คู่สมรสไม่มีรายได้ {formatMoney(a.spouse)} · ลูกคนละ {formatMoney(a.child)} (คนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561 คนละ{' '}
            {formatMoney(a.childSecondFrom2018)}) · พ่อแม่คนละ {formatMoney(a.parent)} สูงสุด {a.parentMax} คน · ผู้พิการคนละ {formatMoney(a.disabled)} · ฝากครรภ์และคลอด{' '}
            {formatMoney(a.maternity)}
          </Group>
          <Group title="ประกัน">
            ประกันสังคม {formatMoney(a.socialSecurity)} · ประกันชีวิตรวมประกันสุขภาพ {formatMoney(a.lifeHealthCombined)} (สุขภาพไม่เกิน {formatMoney(a.health)}) ·
            ประกันสุขภาพพ่อแม่ {formatMoney(a.parentHealth)}
          </Group>
          <Group title="ออมเพื่อเกษียณ (รวมกันไม่เกิน 500,000)">
            RMF {pct(a.rmfRate)} ของรายได้ · กองทุนสำรองเลี้ยงชีพ {pct(a.pvdRate)} · กบข. {pct(a.gpfRate)} · ประกันบำนาญ {pct(a.pensionRate)} ไม่เกิน{' '}
            {formatMoney(a.pensionCap)} · กอช. {formatMoney(a.nsf)}
          </Group>
          <Group title="ลงทุน บ้าน บริจาค">
            Thai ESG / ESGX {pct(a.esgRate)} ไม่เกิน {formatMoney(a.esgCap)} · ดอกเบี้ยบ้าน {formatMoney(a.homeLoanInterest)} · บริจาคไม่เกิน {pct(a.donationRate)} ของเงินได้หลังหักค่าลดหย่อน
            (การศึกษา กีฬา โรงพยาบาลรัฐ ผ่าน e-Donation นับ 2 เท่า) · พรรคการเมือง {formatMoney(a.political)}
          </Group>
        </dl>
      </Card>

      <Card title="4. สิ่งที่หน้านี้ยังไม่ได้คิดให้">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>ดอกเบี้ย เงินปันผล และกำไรจากการขายหุ้นหรืออสังหาฯ ส่วนตัว</li>
          <li>การยื่นภาษีรวมกับคู่สมรส และเงินได้จากต่างประเทศ</li>
          <li>รายจ่ายต้องห้ามของบริษัท VAT และภาษีธุรกิจเฉพาะ</li>
          <li>SSF (ลดหย่อนไม่ได้แล้ว), Easy E-Receipt และเที่ยวเมืองรอง (ยังไม่มีประกาศสำหรับปี {R.taxYear}), โซลาร์รูฟท็อป (สถานะประกาศยังไม่ชัด)</li>
        </ul>
      </Card>

      <Card title="5. รายการที่ยังรอยืนยันกับกรมสรรพากร">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>ข้อยกเว้น {formatMoney(R.seniorExemption)} บาทสำหรับผู้มีอายุ 65 ปีขึ้นไป</li>
          <li>Thai ESG กับ Thai ESGX นับวงเงินรวมกันหรือแยกกัน (หน้านี้นับรวมไว้ก่อนเพื่อความปลอดภัย)</li>
          <li>อัตราหักค่าใช้จ่ายเหมาของนักแสดงและอาชีพในกลุ่มเงินได้ประเภทที่ 8</li>
          <li>มาตรการลดหย่อนที่รัฐบาลอาจประกาศเพิ่มช่วงปลายปี</li>
        </ul>
      </Card>

      <Card title="แหล่งอ้างอิง">
        <ul className="space-y-1 text-sm">
          {R.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-tx-accent underline underline-offset-4">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-tx-muted">รวบรวมเมื่อ {R.updatedAt}</p>
      </Card>

      <Disclaimer />
    </article>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{title}</dt>
      <dd className="num text-tx-muted">{children}</dd>
    </div>
  );
}
