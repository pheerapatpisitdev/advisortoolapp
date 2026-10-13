import Link from "next/link";
import { Rule } from "@/components/sales/Blocks";
import type { PlbCopyFacts } from "@/lib/plb-facts";

export function Disclaimer({ facts }: { facts: PlbCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <p className="pt-8 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        ตัวเลขบนหน้านี้เป็นเบี้ยมาตรฐานจากตารางอัตราเบี้ยฉบับ {facts.rateVersion} ใช้เพื่อประกอบการตัดสินใจเบื้องต้น
        ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์
        ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไข ความคุ้มครอง และข้อยกเว้นก่อนตัดสินใจทำประกันภัยทุกครั้ง
      </p>
      <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        <Link href="/privacy" className="underline underline-offset-4">ความเป็นส่วนตัว</Link>
      </p>
    </footer>
  );
}
