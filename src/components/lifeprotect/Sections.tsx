import { Rule } from "@/components/sales/Blocks";
import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/** What the figures on this page are and are not. Required of any insurance advertisement. */
export function Disclaimer({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {facts.expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยมาตรฐานโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${facts.rateVersion} ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
        </p>
        <p className="mt-2.5">
          ผลประโยชน์ 2 เท่าจ่ายเมื่อเสียชีวิตก่อนครบรอบปีกรมธรรม์ที่อายุ {facts.boosterBeforeAge} ตามเงื่อนไขในกรมธรรม์
          มูลค่าเวนคืนเป็นไปตามตารางในกรมธรรม์ ความคุ้มครองและข้อยกเว้นเป็นไปตามที่ระบุในกรมธรรม์
          การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
