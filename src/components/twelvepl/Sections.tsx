import { Rule } from "@/components/sales/Blocks";

/** What the figures on this page are and are not. Required of any insurance advertisement. */
export function Disclaimer({ expired, rateVersion, salesPeriod }: { expired: boolean; rateVersion: string; salesPeriod: string }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยมาตรฐานโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${rateVersion} (เสนอขาย ${salesPeriod}) ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
        </p>
        <p className="mt-2.5">
          การแสดงเงินปันผลที่ไม่รับรองการจ่าย เป็นการประมาณโดยใช้สมมติฐานอัตราผลตอบแทนการลงทุนที่แตกต่างกัน
          ไม่ได้หมายความถึงอัตราผลตอบแทนขั้นต่ำหรือขั้นสูงที่จะได้รับ มูลค่าเวนคืนไม่รวมเงินจ่ายคืนตามกรมธรรม์
          และลดลงหากมีเงินกู้ตามกรมธรรม์ อัตราดอกเบี้ยกรณีสะสมเงินจ่ายคืนไว้กับบริษัทขั้นต่ำ 0.5% ต่อปี ณ ปัจจุบัน
          ความคุ้มครองและข้อยกเว้นเป็นไปตามที่ระบุในกรมธรรม์ การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
