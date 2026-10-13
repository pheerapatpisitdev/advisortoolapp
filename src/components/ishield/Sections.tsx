import Link from "next/link";
import { Rule } from "@/components/sales/Blocks";
import { DiseaseCard } from "@/components/sales/DiseaseCard";
import type { IShieldCopyFacts } from "@/lib/ishield-facts";
import diseases from "../../../data/riders/ishield-diseases.json";

/**
 * The illnesses, in the company's own two groups, shown as a card and open from the start —
 * the owner asked for the card in place of the folds (2026-09-25). The picture of the same
 * list is handed over from the calculator's buttons; the section's own download link was
 * taken out the same day.
 */
export function IllnessSection({ facts }: { facts: IShieldCopyFacts }) {
  const groups = [
    { title: `ระยะเริ่มต้น ${facts.illness.earlyCount} โรค`, names: diseases.early, note: `รับ ${facts.illness.earlyPercent}% ของทุนประกันต่อโรค` },
    { title: `ระยะรุนแรง ${facts.illness.majorCount} โรค`, names: diseases.major, note: `รับสูงสุด ${facts.illness.majorPercent}% ของทุนประกัน` },
  ];
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <DiseaseCard
          plan="iShield"
          total={facts.illnessTotal}
          groups={groups}
          footnote={<>
            {diseases.note} · ไม่คุ้มครองโรคร้ายแรงที่เกิดขึ้นภายใน {facts.illness.waitingDays} วันแรก
            นับจากวันที่กรมธรรม์เริ่มมีผลบังคับ
          </>}
        />
      </div>
    </section>
  );
}

export function Disclaimer({ facts }: { facts: IShieldCopyFacts }) {
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
