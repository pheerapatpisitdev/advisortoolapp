import Link from "next/link";
import { Rule } from "@/components/sales/Blocks";
import type { PensionCopyFacts } from "@/lib/pension-facts";

export function Disclaimer({ facts }: { facts: PensionCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <p className="pt-8 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        ชื่อแบบประกันภัย: บำนาญ สมาร์ท 95 (บำนาญแบบลดหย่อนภาษีได้)
      </p>
      <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        ตัวเลขบนหน้านี้เป็นเบี้ยมาตรฐานจากตารางอัตราเบี้ยฉบับ {facts.rateVersion} ใช้เพื่อประกอบการตัดสินใจเบื้องต้น
        ไม่ใช่ใบเสนอราคา เบี้ยและผลประโยชน์จริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์
        สิทธิลดหย่อนภาษีเป็นไปตามเงื่อนไขของกรมสรรพากร
        ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไข ความคุ้มครอง และข้อยกเว้นก่อนตัดสินใจทำประกันภัยทุกครั้ง
      </p>
      <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        <Link href="/privacy" className="underline underline-offset-4">ความเป็นส่วนตัว</Link>
      </p>
    </footer>
  );
}
