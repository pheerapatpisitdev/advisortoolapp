import Link from "next/link";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Rule } from "@/components/sales/Blocks";
import { GlobalSavingCalculator } from "@/components/global-saving/GlobalSavingCalculator";
import { IndexFactsheet } from "@/components/global-saving/IndexFactsheet";
import { GS_AGE_MAX, GS_AGE_MIN, GS_PREM_YEARS, GS_TERM } from "@/calc/global-saving/engine";

export const metadata = {
  title: "Global Savings Plus 15/8 — ออมทรัพย์ผลตอบแทนตามดัชนี",
  description:
    `ประกันออมทรัพย์ คุ้มครอง ${GS_TERM} ปี จ่ายเบี้ย ${GS_PREM_YEARS} ปี เงินคืน 1% ทุกปี ครบสัญญา 801% ของทุน `
    + "บวกโบนัสตามดัชนี Citi Grandmaster RC 5 ลดหย่อนภาษีได้ คำนวณเงินรับแต่ละสถานการณ์ได้ทันที",
};

/**
 * An agents' tool like the other plan pages (owner approved the mockup ก ก, 2026-10-20): the
 * plan's name and facts, the calculator, the index its bonus follows, and the legal lines.
 */
export default function GlobalSavingPage() {
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="Global Savings Plus 15/8" kind="ประกันออมทรัพย์ ผลตอบแทนตามดัชนี (Index Linked)"
                 facts={[`คุ้มครอง ${GS_TERM} ปี`, `จ่ายเบี้ย ${GS_PREM_YEARS} ปี`, `รับอายุ ${GS_AGE_MIN}–${GS_AGE_MAX} ปี`, "ลดหย่อนภาษีได้"]} />
      <section id="calc" className="scroll-mt-4">
        <GlobalSavingCalculator />
      </section>
      <IndexFactsheet />
      <footer className="pb-10">
        <Rule />
        <ul className="list-disc space-y-1.5 pl-5 pt-8 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
          <li>
            เงินการันตี (เงินคืนรายปี 1% ของทุน · ครบสัญญา 801% ของทุน · มูลค่าเวนคืน) ได้รับแน่นอน
            โบนัสตามดัชนีไม่การันตี จ่ายสิ้นปีที่ 10 และครบสัญญา
          </li>
          <li>
            นำเบี้ยไปลดหย่อนภาษีเงินได้บุคคลธรรมดาได้ตามจ่ายจริง สูงสุด 100,000 บาท/ปี เฉพาะปีที่ชำระเบี้ย
            เป็นวงเงินรวมทุกกรมธรรม์ประกันชีวิตที่มีระยะคุ้มครอง 10 ปีขึ้นไป ตามเกณฑ์กรมสรรพากร
          </li>
          <li>ตัวเลขเป็นประมาณการเพื่อเปรียบเทียบ อาจต่างจากใบเสนอของบริษัทเล็กน้อยจากการปัดเศษ และมิใช่ส่วนหนึ่งของกรมธรรม์</li>
        </ul>
        <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
          “โกลบอล เซฟวิ่งส์ พลัส 15/8 (อินเด็กซ์ ลิงค์)” เป็นชื่อทางการตลาดของแบบ โกลบอล เซฟวิ่งส์ พลัส 15/8
          แบบมีผลตอบแทนตามดัชนีอ้างอิง ของบริษัท กรุงไทย-แอกซา ประกันชีวิต จำกัด (มหาชน)
          ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไข ความคุ้มครอง และข้อยกเว้นก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
        <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
          <Link href="/privacy" className="underline underline-offset-4">ความเป็นส่วนตัว</Link>
        </p>
      </footer>
    </main>
  );
}
