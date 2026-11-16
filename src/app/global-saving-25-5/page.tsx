import { gateCalc } from "@/lib/auth/viewer";
import Link from "next/link";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Rule } from "@/components/sales/Blocks";
import { GlobalSaving255Calculator } from "@/components/global-saving/GlobalSaving255Calculator";
import { IndexFactsheet } from "@/components/global-saving/IndexFactsheet";
import { LiveIndex } from "@/components/global-saving/LiveIndex";
import { loadIndexWeeks } from "@/lib/index-levels/store";
import { GS25_AGE_MAX, GS25_AGE_MIN, GS25_PREM_YEARS, GS25_TERM } from "@/calc/global-saving/engine-25-5";

export const metadata = {
  title: "Global Savings Plus 25/5 — ออมทรัพย์ผลตอบแทนตามดัชนี",
  description:
    `ประกันออมทรัพย์ คุ้มครอง ${GS25_TERM} ปี จ่ายเบี้ย ${GS25_PREM_YEARS} ปี เงินคืน 1% ทุกปี ครบสัญญา 501% ของทุน `
    + "บวกโบนัสตามดัชนี Citi Grandmaster RC 5 ลดหย่อนภาษีได้ คำนวณเงินรับแต่ละสถานการณ์ได้ทันที",
};

/**
 * Global Savings Plus 25/5 on a page of its own (owner chose แยกหน้า, 2026-11-16), built as
 * 15/8's is (../global-saving/page.tsx): the plan's name and facts, the calculator, then the
 * index both plans follow — its newest weekly level and its fact sheet, the same components.
 * Members only, like every calculator.
 */

export default async function GlobalSaving255Page() {
  await gateCalc("/global-saving-25-5");
  const weeks = await loadIndexWeeks();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="Global Savings Plus 25/5" kind="ประกันออมทรัพย์ ผลตอบแทนตามดัชนี (Index Linked)"
                 facts={[`คุ้มครอง ${GS25_TERM} ปี`, `จ่ายเบี้ย ${GS25_PREM_YEARS} ปี`, `รับอายุ ${GS25_AGE_MIN}–${GS25_AGE_MAX} ปี`, "ลดหย่อนภาษีได้"]} />
      <section id="calc" className="scroll-mt-4">
        <GlobalSaving255Calculator />
      </section>
      <LiveIndex weeks={weeks} />
      <IndexFactsheet />
      <footer className="pb-10">
        <Rule />
        <ul className="list-disc space-y-1.5 pl-5 pt-8 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
          <li>
            เงินการันตี (เงินคืนรายปี 1% ของทุน · ครบสัญญา 501% ของทุน · มูลค่าเวนคืน) ได้รับแน่นอน
            โบนัสตามดัชนีไม่การันตี จ่ายสิ้นปีที่ 10, 15, 20 และครบสัญญา
          </li>
          <li>
            นำเบี้ยไปลดหย่อนภาษีเงินได้บุคคลธรรมดาได้ตามจ่ายจริง สูงสุด 100,000 บาท/ปี เฉพาะปีที่ชำระเบี้ย
            เป็นวงเงินรวมทุกกรมธรรม์ประกันชีวิตที่มีระยะคุ้มครอง 10 ปีขึ้นไป ตามเกณฑ์กรมสรรพากร
          </li>
          <li>ตัวเลขเป็นประมาณการเพื่อเปรียบเทียบ อาจต่างจากใบเสนอของบริษัทเล็กน้อยจากการปัดเศษ และมิใช่ส่วนหนึ่งของกรมธรรม์</li>
        </ul>
        <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
          “โกลบอล เซฟวิ่งส์ พลัส 25/5 (อินเด็กซ์ ลิงค์)” เป็นชื่อทางการตลาดของแบบ โกลบอล เซฟวิ่งส์ พลัส 25/5
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
