import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import { DiseaseCard } from "@/components/sales/DiseaseCard";
import type { IShieldCopyFacts } from "@/lib/ishield-facts";
import diseases from "../../../data/riders/ishield-diseases.json";

/**
 * The pitch, straight after the price: one contract that pays on three different days. It is
 * the thing that separates this plan from a health policy, which pays a hospital and nothing
 * else, and from a life policy, which pays only once the customer is gone.
 */
export function ThreeWaysSection({ facts }: { facts: IShieldCopyFacts }) {
  const { example } = facts;
  const ways = [
    { when: "ป่วย", what: `ตรวจพบโรคร้ายแรงระยะรุนแรง`, amount: example.major, note: `${facts.illness.majorCount} โรค · รับเป็นเงินก้อน ใช้อย่างไรก็ได้` },
    { when: "ป่วยระยะเริ่มต้น", what: "ตรวจพบระยะเริ่มต้น", amount: example.early, note: `${facts.illness.earlyCount} โรค · ${facts.illness.earlyPercent}% ของทุนต่อโรค เคลมได้อีกถ้าเป็นคนละโรค` },
    { when: "เสียชีวิต", what: "ครอบครัวได้รับ", amount: example.sum, note: "ไม่ว่าจะอายุเท่าไร ตลอดสัญญา" },
    { when: `อยู่ถึง ${facts.maturityAge}`, what: "รับคืนครบสัญญา", amount: example.sum, note: "เงินที่จ่ายไปไม่ได้หายไปไหน" },
  ];
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ทุน {example.sumShort} สัญญาเดียว</span>
        <br />
        <span className="lg-metal-text">จ่ายได้สี่จังหวะของชีวิต</span>
      </h2>

      <dl className="relative mt-7 space-y-5">
        {ways.map((w) => (
          <div key={w.when} className="border-b border-[var(--lg-panel-line)] pb-5 last:border-b-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium text-[var(--lg-white)]">{w.what}</dt>
              <dd className="lg-figure shrink-0 text-lg tabular-nums text-[var(--lg-gold)]">{w.amount} บาท</dd>
            </div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">{w.note}</p>
          </div>
        ))}
      </dl>

      <p className="relative mt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        ตัวอย่างบนทุน {example.sum} บาท · เมื่อรับผลประโยชน์ระยะเริ่มต้นแล้ว ทุนประกันและมูลค่าเวนคืนจะลดลง
        ตามสัดส่วนที่จ่ายไป
      </p>
    </section>
  );
}

/** Why this plan rather than the health policy the customer probably already has. */
export function WhySection({ facts }: { facts: IShieldCopyFacts }) {
  const points = [
    {
      title: "เงินก้อน ไม่ใช่ค่าห้องค่ายา",
      body: "ประกันสุขภาพจ่ายให้โรงพยาบาล แต่ไม่จ่ายค่าผ่อนบ้าน ค่าเทอมลูก หรือรายได้ที่หายไปตอนพักรักษาตัว แบบนี้จ่ายเป็นเงินสดเข้ามือ ใช้กับอะไรก็ได้",
    },
    {
      title: `เจอตั้งแต่ระยะเริ่มต้นก็ได้เงิน`,
      body: `ไม่ต้องรอให้ถึงขั้นรุนแรง ${facts.illness.earlyCount} โรคในระยะเริ่มต้นรับ ${facts.illness.earlyPercent}% ของทุนทันที และถ้าเป็นคนละโรคก็เคลมได้อีก`,
    },
    {
      title: "เบี้ยเท่าเดิมทุกปี จ่ายมีวันจบ",
      body: "ไม่ใช่แบบที่เบี้ยขึ้นตามอายุทุกปี ล็อกที่อายุวันที่ทำ เลือกจ่าย 5 10 15 หรือ 20 ปี แล้วคุ้มครองยาวต่อโดยไม่ต้องจ่ายอีก",
    },
    {
      title: `ไม่ป่วยเลยก็ไม่เสียเปล่า`,
      body: `อยู่ครบสัญญาอายุ ${facts.maturityAge} ปี รับคืนเต็มทุนประกัน และระหว่างทางมีมูลค่าเงินสดที่เวนคืนหรือกู้ได้ตามเงื่อนไข`,
    },
  ];
  return (
    <section className="py-12">
      <H2>ทำไมมีประกันสุขภาพแล้วยังต้องมีตัวนี้</H2>
      <div className="mt-7 space-y-6">
        {points.map((p, i) => (
          <div key={p.title} className="flex gap-4">
            <span className="lg-figure shrink-0 text-sm tabular-nums text-[var(--lg-gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-medium text-[var(--lg-white)]">{p.title}</div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

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

/**
 * The objections, answered before they are raised. The ninety-day wait leads, because it is
 * the fact most likely to be discovered later and resented.
 */
export function FaqSection({ facts }: { facts: IShieldCopyFacts }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คำถามที่พบบ่อย</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          <Fold summary={`ทำวันนี้ คุ้มครองโรคร้ายแรงเลยไหม`}>
            ยังครับ แบบนี้ไม่คุ้มครองโรคร้ายแรงที่เกิดขึ้นภายใน {facts.illness.waitingDays} วันแรก
            นับจากวันที่กรมธรรม์เริ่มมีผลบังคับ เป็นเงื่อนไขมาตรฐานของประกันโรคร้ายแรงทุกบริษัท
            ส่วนความคุ้มครองชีวิตมีผลตั้งแต่วันแรก
          </Fold>
          <Fold summary="เคลมระยะเริ่มต้นแล้ว ความคุ้มครองที่เหลือเป็นอย่างไร">
            ทุนประกันจะลดลงตามสัดส่วนของเงินที่จ่ายไป เช่นรับไป {facts.illness.earlyPercent}% ทุนที่เหลือก็ลดลง
            {facts.illness.earlyPercent}% และมูลค่าเวนคืนลดตามด้วย ส่วนที่เหลือยังคุ้มครองต่อทั้งชีวิตและโรคร้ายแรง
          </Fold>
          <Fold summary="ป่วยระยะเริ่มต้นหลายโรค เคลมได้กี่ครั้ง">
            เคลมได้อีกถ้าเป็นคนละโรคกับที่เคยเคลม แต่ละครั้งรับ {facts.illness.earlyPercent}% ของทุนประกัน
            ส่วนระยะรุนแรงจ่ายสูงสุด {facts.illness.majorPercent}% ของทุน โดยหักเงินที่จ่ายในระยะเริ่มต้นไปแล้วออก
          </Fold>
          <Fold summary="เบี้ยขึ้นตามอายุทุกปีไหม">
            ไม่ขึ้นครับ เบี้ยล็อกที่อายุ ณ วันที่ทำ และเท่าเดิมตลอดระยะเวลาชำระ ต่างจากสัญญาเพิ่มเติม
            ที่ต่ออายุปีต่อปี ซึ่งเบี้ยจะปรับตามอายุ
          </Fold>
          <Fold summary="ไม่ป่วยเลย เงินที่จ่ายไปหายไหม">
            ไม่หายครับ อยู่ครบสัญญาอายุ {facts.maturityAge} ปี รับคืนเต็มทุนประกัน และระหว่างทางมีมูลค่าเงินสด
            ที่เวนคืนหรือกู้ได้ตามเงื่อนไขกรมธรรม์ ดูได้จากตารางมูลค่าทุกปีในเครื่องคำนวณด้านบน —
            เช่นทุน {facts.example.sum} บาท ชำระ 10 ปี ที่อายุ 60 มีมูลค่า {facts.cash60} บาท
          </Fold>
          <Fold summary="อายุเท่าไรทำได้ และทุนเท่าไร">
            รับตั้งแต่แรกเกิดถึงอายุ {facts.ageMax} ปี ทุนประกันตั้งแต่ {facts.saMin} ถึง {facts.saMax} บาท
            อายุสูงสุดต่างกันตามระยะเวลาชำระ เครื่องคำนวณจะปิดแบบที่อายุนั้นทำไม่ได้ให้เอง
          </Fold>
          <Fold summary="อยากได้ค่าห้องค่ารักษาด้วย">
            แบบนี้เป็นเงินก้อน ไม่ใช่ค่ารักษา ถ้าต้องการค่ารักษาพยาบาลหรือค่าชดเชยรายวันด้วย
            พ่วงสัญญาเพิ่มเติมได้ ทักมาคุยกันได้เลย หรือ{" "}
            <Link href="/lifeprotect" className="text-[var(--lg-gold)] underline underline-offset-4">
              ดู Life Protect x 2
            </Link>{" "}
            ถ้าสิ่งที่ต้องการคือคุ้มครองชีวิตเป็นหลัก
          </Fold>
        </div>
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
    </footer>
  );
}
