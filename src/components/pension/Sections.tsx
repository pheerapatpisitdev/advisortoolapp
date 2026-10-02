import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { PensionCopyFacts } from "@/lib/pension-facts";
import { TaxBox } from "./TaxBox";

const n = (x: number) => x.toLocaleString("en-US");

/**
 * What the contract pays and when, on the page's own example. Every sentence is one the
 * engine computes — the bands, the two ways a death is paid — so none of it is a promise the
 * yearly table below would contradict.
 */
export function WhatItPaysSection({ facts }: { facts: PensionCopyFacts }) {
  const q = facts.example.quote;
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">บำนาญเดือนละ {n(q.monthlyPension)} ตั้งแต่อายุ {q.plan.annuityStartAge}</span>
        <br />
        <span className="lg-metal-text">ยิ่งอายุมาก ยิ่งได้มากขึ้น</span>
      </h2>

      <dl className="relative mt-7 space-y-3">
        {q.bands.map((b) => (
          <div key={b.fromAge} className="flex items-baseline justify-between gap-3 border-b border-[var(--lg-panel-line)] pb-3 last:border-b-0">
            <dt className="text-[var(--lg-white)]">
              อายุ {b.fromAge}–{b.toAge}
              <span className="ml-2 text-sm text-[var(--lg-mute)]">{Math.round(b.percent * 100)}% ของทุน</span>
            </dt>
            <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-gold)]">
              ปีละ {n(b.annual)} บาท
            </dd>
          </div>
        ))}
      </dl>
      <p className="relative mt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
        รวมรับบำนาญถึงอายุ 95 ประมาณ <span className="text-[var(--lg-white)]">{n(q.totalPension)} บาท</span>{" "}
        จากเบี้ยรวม {n(Math.floor(q.totalPremium))} บาท
      </p>

      <div className="relative mt-7 space-y-5 border-t border-[var(--lg-panel-line)] pt-6">
        <div>
          <div className="font-medium text-[var(--lg-white)]">ถ้าเสียชีวิตก่อนเริ่มรับบำนาญ</div>
          <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
            ปีที่ 1–2 ครอบครัวได้คืน 100% ของเบี้ยที่จ่ายมา ตั้งแต่ปีที่ 3 ได้ 110%
            หรือมูลค่าเวนคืน แล้วแต่จำนวนใดมากกว่า
          </p>
        </div>
        <div>
          <div className="font-medium text-[var(--lg-white)]">ถ้าเสียชีวิตระหว่างรับบำนาญ</div>
          <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
            บำนาญ 15 ปีแรกรับประกันไว้ ครอบครัวได้มูลค่าของบำนาญส่วนที่ยังไม่ได้รับในช่วงนั้น
            หรือเบี้ยที่จ่ายมาหักบำนาญที่รับไปแล้ว แล้วแต่จำนวนใดมากกว่า
          </p>
        </div>
      </div>

      <p className="relative mt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        ตัวอย่าง {facts.example.sex === "M" ? "ชาย" : "หญิง"} อายุ {facts.example.age} ทุน {n(q.sumAssured)} บาท
        ชำระเบี้ยจนถึงอายุ {q.plan.annuityStartAge} ปีละ {n(Math.floor(q.annualPremium))} บาท
      </p>
    </section>
  );
}

export function WhySection() {
  const points = [
    {
      title: "รายได้ที่รู้จำนวนตั้งแต่วันนี้",
      body: "บำนาญคิดเป็นสัดส่วนของทุนประกันที่ตกลงกันตั้งแต่วันทำสัญญา "
        + "ไม่ขึ้นกับตลาดหุ้นหรือดอกเบี้ยในวันที่คุณเกษียณ",
    },
    {
      title: "ได้มากขึ้นในวัยที่ใช้มากขึ้น",
      body: "บำนาญเพิ่มเป็นขั้นจาก 15% เป็น 20% 25% และ 30% ของทุน "
        + "ตามอายุที่สูงขึ้น ซึ่งเป็นช่วงที่ค่าใช้จ่ายด้านสุขภาพมักเพิ่มขึ้นตาม",
    },
    {
      title: "ลดหย่อนภาษีระหว่างที่ยังทำงาน",
      body: "เบี้ยประกันบำนาญใช้สิทธิลดหย่อนภาษีได้ตามเกณฑ์สรรพากร "
        + "ประหยัดภาษีทุกปีที่จ่าย ส่วนลดหย่อนเท่าไรคำนวณได้ด้านล่าง",
    },
    {
      title: "จ่ายจบก่อนเกษียณ",
      body: "เลือกจ่ายเพียง 6 ปี หรือจ่ายทุกปีจนถึงวันเริ่มรับบำนาญ "
        + "ช่วงรับบำนาญไม่มีเบี้ยต้องจ่ายอีก",
    },
  ];
  return (
    <section className="py-12">
      <H2>ทำไมต้องมีบำนาญ</H2>
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

export function TaxSection() {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>ลดหย่อนภาษีได้อีกเท่าไร</H2>
        <p className="mt-2 text-sm leading-[1.85] text-[var(--lg-mute)]">
          กรอกเงินได้และสิทธิที่ใช้ไปแล้ว ระบบคำนวณเบี้ยบำนาญที่ยังซื้อเพิ่มเพื่อลดหย่อนได้ และภาษีที่ประหยัดได้โดยประมาณ
        </p>
        <div className="pension-tool">
          <TaxBox />
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ facts }: { facts: PensionCopyFacts }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คำถามที่พบบ่อย</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          <Fold summary="จ่าย 6 ปี กับ จ่ายจนเริ่มรับบำนาญ ต่างกันอย่างไร">
            ทุนเท่ากันได้บำนาญเท่ากัน ต่างกันที่วิธีจ่ายเบี้ย แบบ 6 ปีเบี้ยต่อปีสูงกว่าแต่จบเร็ว
            แบบจ่ายจนเริ่มรับบำนาญเบี้ยต่อปีต่ำกว่าแต่จ่ายนานกว่า เลือกทั้งสองแบบในเครื่องคำนวณด้านบนเพื่อเทียบได้
          </Fold>
          <Fold summary="อายุเท่าไรทำได้">
            รับอายุ {facts.ageMin}–{facts.ageMax} ปี แต่อายุที่เริ่มรับบำนาญได้ขึ้นกับอายุวันนี้ —
            กรณีจ่ายจนเริ่มรับบำนาญ{" "}
            {facts.latestEntry.map((e) => `รับที่ ${e.pensionAge} ทำได้ถึงอายุ ${e.ageMax}`).join(" · ")}
          </Fold>
          <Fold summary="เบี้ยขึ้นตามอายุทุกปีไหม">
            เบี้ยสัญญาหลักคงที่ตลอดระยะเวลาชำระ คิดจากอายุวันที่ทำสัญญา
            ยกเว้นสัญญาเพิ่มเติม DCI ซึ่งเบี้ยปรับตามอายุทุกปี
          </Fold>
          <Fold summary="ลดหย่อนภาษีได้เท่าไร">
            เบี้ยบำนาญลดหย่อนได้ไม่เกิน 15% ของเงินได้ และไม่เกิน 200,000 บาท
            เมื่อรวมกับกองทุนเพื่อการเกษียณอื่น เช่น PVD กบข. RMF แล้วต้องไม่เกิน 500,000 บาท
            ถ้ายังใช้สิทธิเบี้ยประกันชีวิต 100,000 บาทไม่เต็ม ส่วนหนึ่งของเบี้ยบำนาญนำไปใช้ในสิทธินั้นได้ก่อน
            ทั้งนี้เป็นไปตามเงื่อนไขของกรมสรรพากร
          </Fold>
          <Fold summary="พ่วงสัญญาเพิ่มเติมได้ไหม">
            เครื่องคำนวณด้านบนพ่วงได้ 3 แบบ: WP ยกเว้นเบี้ยเมื่อผู้เอาประกันทุพพลภาพหรือเป็นโรคร้ายแรง,
            PB ยกเว้นเบี้ยเมื่อผู้ชำระเบี้ยเป็นอะไรไป และ DCI โรคร้ายแรง
            สัญญาเพิ่มเติมอื่นทักมาสอบถามได้
          </Fold>
          <Fold summary="อยากได้ความคุ้มครองชีวิตสูง ๆ ด้วย">
            บำนาญ สมาร์ท 95 เน้นรายได้หลังเกษียณ ความคุ้มครองชีวิตก่อนรับบำนาญคือเบี้ยที่จ่ายมาหรือมูลค่าเวนคืน
            ถ้าต้องการเงินก้อนให้ครอบครัวสูงกว่านั้น ดู{" "}
            <Link href="/lifeprotect" className="text-[var(--lg-gold)] underline underline-offset-4">
              Life Protect x 2
            </Link>
          </Fold>
        </div>
      </div>
    </section>
  );
}

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
    </footer>
  );
}
