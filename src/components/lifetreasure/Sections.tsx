import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { LifeTreasureCopyFacts } from "@/lib/lifetreasure-facts";

/**
 * The pitch, straight after the price: one sum, payable whenever it is needed, with two
 * floors under it that mean the contract never hands back less than what went in.
 */
export function WhatItPaysSection({ facts }: { facts: LifeTreasureCopyFacts }) {
  const { example } = facts;
  const ways = [
    {
      what: "เสียชีวิต ไม่ว่าปีไหน",
      amount: example.sum,
      note: `ทุกช่วงอายุ จนถึงอายุ ${facts.coverToAge} · ผู้รับประโยชน์ได้เป็นเงินก้อน ตามสัดส่วนที่คุณระบุไว้`,
    },
    {
      what: `อย่างน้อยเสมอ ${facts.premiumFloorPercent}% ของเบี้ยที่ชำระมาแล้ว`,
      amount: null,
      note: "กรมธรรม์จ่ายจำนวนที่มากกว่าระหว่าง ทุนประกัน มูลค่าเวนคืน "
        + `และ ${facts.premiumFloorPercent}% ของเบี้ยที่ชำระมาแล้ว จึงไม่มีทางได้คืนน้อยกว่าที่จ่ายไป`,
    },
    {
      what: `อยู่ถึงอายุ ${facts.coverToAge}`,
      amount: facts.growth?.atEnd ?? null,
      note: "ครบสัญญารับมูลค่าเวนคืนซึ่งเท่ากับทุนประกันเต็มจำนวน",
    },
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
        <span className="lg-metal-text">จำนวนที่รู้ล่วงหน้า ไม่ต้องเดา</span>
      </h2>

      <dl className="relative mt-7 space-y-5">
        {ways.map((w) => (
          <div key={w.what} className="border-b border-[var(--lg-panel-line)] pb-5 last:border-b-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium text-[var(--lg-white)]">{w.what}</dt>
              {w.amount && (
                <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-gold)]">
                  {w.amount} บาท
                </dd>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">{w.note}</p>
          </div>
        ))}
      </dl>

      <p className="relative mt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        ตัวอย่างบนทุน {example.sum} บาท
      </p>
    </section>
  );
}

/** Why a policy rather than any of the other ways to leave money behind. */
export function WhySection({ facts }: { facts: LifeTreasureCopyFacts }) {
  const points = [
    {
      title: "เงินก้อนที่พร้อมใช้ในวันแรก",
      body: "ค่าจัดการ ภาษี หนี้ที่ค้างอยู่ และค่าใช้จ่ายของครอบครัวมาถึงก่อนที่ทรัพย์สินจะแบ่งเสร็จ "
        + "เงินจากกรมธรรม์จ่ายให้ผู้รับประโยชน์โดยตรง ครอบครัวจึงไม่ต้องรีบขายที่ดินหรือธุรกิจเพื่อหาสภาพคล่อง",
    },
    {
      title: "จำนวนแน่นอน ไม่ขึ้นกับตลาด",
      body: "ที่ดิน หุ้น หรือกิจการ จะมีค่าเท่าไรในวันนั้นไม่มีใครรู้ "
        + "แต่ทุนประกันเป็นตัวเลขที่ตกลงกันไว้ตั้งแต่วันทำสัญญา และเป็นตัวเลขเดิมไม่ว่าจะเกิดอะไรขึ้นระหว่างทาง",
    },
    {
      title: "แบ่งให้ใครเท่าไร ระบุได้",
      body: "ที่ดินผืนเดียวแบ่งลูกสามคนให้ลงตัวยาก เงินก้อนแบ่งได้ตามสัดส่วนที่คุณเขียนไว้ในกรมธรรม์ "
        + "และยังใช้เป็นเงินชดเชยให้ทายาทที่ไม่ได้รับตัวทรัพย์สินได้ด้วย",
    },
    {
      title: `จ่ายจบแล้วคุ้มครองยาวถึง ${facts.coverToAge}`,
      body: "เลือกจ่าย 6 12 หรือ 18 ปี เบี้ยเท่าเดิมทุกปี ครบกำหนดแล้วไม่มีเบี้ยตามมาอีก "
        + "แต่ความคุ้มครองยังอยู่ และมูลค่าเวนคืนยังโตต่อไปทุกปี",
    },
  ];
  return (
    <section className="py-12">
      <H2>ทำไมต้องเป็นกรมธรรม์ ไม่ใช่ที่ดินหรือเงินฝาก</H2>
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
 * The three terms side by side, on one arrangement. The column the reader is really looking
 * at is the total, and beside it the multiple — which is the number this plan is bought or
 * refused on, and which disappears rather than dips under one.
 */
export function TermsSection({ facts }: { facts: LifeTreasureCopyFacts }) {
  const { example } = facts;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>จ่ายกี่ปีดี</H2>
        <p className="mt-2 text-sm text-[var(--lg-mute)]">
          {example.sex === "M" ? "ชาย" : "หญิง"} {example.age} ปี · ทุน {example.sum} บาท
        </p>
        <div className="mt-7 space-y-6">
          {example.terms.map((t) => (
            <div key={t.label} className="border-b border-[var(--lg-panel-line)] pb-5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium text-[var(--lg-white)]">{t.label}</div>
                {t.premium && (
                  <div className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                    {t.premium} <span className="text-sm text-[var(--lg-mute)]">บาท{t.per}</span>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
                {t.total ? <>เบี้ยรวม {t.total} บาท</> : <>จ่าย {t.years} ปี</>}
                {t.leverage && (
                  <> · ส่งต่อ <span className="text-[var(--lg-gold)]">{t.leverage} เท่า</span>ของเบี้ยที่จ่าย</>
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
          จ่ายสั้นกว่าคือจบเร็วกว่า จ่ายยาวกว่าคือเบี้ยต่องวดเบากว่า ความคุ้มครองและทุนเท่ากันทุกแบบ
          ยิ่งทำตอนอายุน้อย เบี้ยรวมยิ่งต่ำและส่งต่อได้หลายเท่ากว่า
        </p>
      </div>
    </section>
  );
}

/**
 * What the policy is worth while it is still running. An estate buyer's real objection is
 * that the money is locked away, and the honest answer is a break-even year and two figures
 * — all three read off the company's own surrender table.
 */
export function GrowthSection({ facts }: { facts: LifeTreasureCopyFacts }) {
  const { growth, example } = facts;
  if (!growth) return null;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>เงินไม่ได้หายไปไหน</H2>
        <p className="mt-2 text-sm text-[var(--lg-mute)]">
          {example.sex === "M" ? "ชาย" : "หญิง"} {example.age} ปี · ทุน {example.sum} บาท · {growth.termLabel}
        </p>
        <div className="mt-7 space-y-6">
          {growth.breakEvenAge !== null && (
            <div>
              <div className="font-medium text-[var(--lg-white)]">
                เท่าทุนที่อายุ {growth.breakEvenAge} (ปีกรมธรรม์ที่ {growth.breakEvenYear})
              </div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
                ตั้งแต่ปีนั้นไป มูลค่าเวนคืนไม่น้อยกว่าเบี้ยที่จ่ายสะสมมาทั้งหมด
                ถ้าเปลี่ยนใจก็เวนคืนได้ตามเงื่อนไขกรมธรรม์
              </p>
            </div>
          )}
          {growth.at70 && (
            <div>
              <div className="font-medium text-[var(--lg-white)]">อายุ 70 มีมูลค่า {growth.at70} บาท</div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
                ระหว่างทางใช้เป็นหลักประกันในการกู้ตามเงื่อนไขกรมธรรม์ได้ โดยความคุ้มครองยังอยู่
              </p>
            </div>
          )}
          <div>
            <div className="font-medium text-[var(--lg-white)]">
              อายุ {facts.coverToAge} มีมูลค่า {growth.atEnd} บาท
            </div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
              เท่ากับทุนประกันเต็มจำนวน — อยู่ครบสัญญาก็ได้เท่าที่ตั้งใจจะส่งต่อ
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
          ตัวเลขทุกปีดูได้จากกราฟและตารางในเครื่องคำนวณด้านบน ซึ่งขยับตามทุนและอายุที่เลือก
        </p>
      </div>
    </section>
  );
}

/** The objections, answered before they are raised. */
export function FaqSection({ facts }: { facts: LifeTreasureCopyFacts }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คำถามที่พบบ่อย</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          <Fold summary={`ทำไมทุนขั้นต่ำต้อง ${facts.saMinShort}`}>
            แบบนี้ออกแบบมาสำหรับการส่งต่อทรัพย์สิน ไม่ใช่ประกันคุ้มครองรายได้ทั่วไป
            บริษัทจึงกำหนดทุนขั้นต่ำไว้ที่ {facts.saMin} บาท ถ้าต้องการทุนต่ำกว่านี้{" "}
            <Link href="/lifeprotect" className="text-[var(--lg-gold)] underline underline-offset-4">
              Life Protect x 2
            </Link>{" "}
            หรือ{" "}
            <Link href="/plb" className="text-[var(--lg-gold)] underline underline-offset-4">
              Protection Life
            </Link>{" "}
            เหมาะกว่า
          </Fold>
          <Fold summary="ถ้าเสียชีวิตในปีแรก ๆ ได้เต็มทุนเลยไหม">
            ได้ครับ ทุนประกันจ่ายเต็มจำนวนทุกช่วงอายุตลอดสัญญา ไม่มีการลดหลั่นตามปีที่ถือ
            ทั้งที่เบี้ยยังจ่ายไปเพียงไม่กี่ปี — นี่คือส่วนที่ทำให้แบบนี้ต่างจากการเก็บเงินเอง
            ทั้งนี้เป็นไปตามเงื่อนไขและข้อยกเว้นในกรมธรรม์ เช่น กรณีฆ่าตัวตายหรือถูกผู้รับประโยชน์ฆ่า
            ภายในระยะเวลาที่กรมธรรม์กำหนด
          </Fold>
          <Fold summary="เบี้ยขึ้นตามอายุทุกปีไหม">
            ไม่ขึ้นครับ เบี้ยล็อกที่อายุ ณ วันที่ทำ และเท่าเดิมตลอดระยะเวลาชำระ
            ครบ 6 12 หรือ 18 ปีตามที่เลือกแล้วไม่ต้องจ่ายอีก แต่คุ้มครองต่อถึงอายุ {facts.coverToAge}
          </Fold>
          <Fold summary="ระหว่างทางถอนเงินออกมาใช้ได้ไหม">
            เวนคืนกรมธรรม์เพื่อรับมูลค่าเงินสด หรือกู้ตามเงื่อนไขกรมธรรม์ได้
            แต่การเวนคืนคือการจบสัญญา ความคุ้มครองจะหมดไปด้วย
            ตารางมูลค่าทุกปีอยู่ในเครื่องคำนวณด้านบน
          </Fold>
          <Fold summary="อายุเท่าไรทำได้ และทุนสูงสุดเท่าไร">
            รับตั้งแต่แรกเกิดถึงอายุ {facts.ageMax} ปี เครื่องคำนวณด้านบนเลื่อนทุนได้ถึง {facts.saMax} บาท
            ถ้าต้องการมากกว่านั้นทักมาคุยได้ ทุนสูง ๆ บริษัทจะมีขั้นตอนพิจารณาสุขภาพและฐานะการเงินเพิ่มเติม
          </Fold>
          <Fold summary="ลดหย่อนภาษีได้ไหม">
            ได้ครับ เป็นเบี้ยประกันชีวิตที่ใช้สิทธิลดหย่อนได้ตามที่จ่ายจริง
            ไม่เกินเพดานที่กรมสรรพากรกำหนด และเป็นไปตามเงื่อนไขของประกาศอธิบดีกรมสรรพากร
          </Fold>
          <Fold summary="อยากได้ความคุ้มครองโรคร้ายแรงด้วย">
            สัญญาหลักตัวนี้จ่ายเมื่อเสียชีวิต ถ้าต้องการเงินก้อนตอนตรวจพบโรคร้ายแรงด้วย
            พ่วงสัญญาเพิ่มเติมได้ หรือดู{" "}
            <Link href="/ishield" className="text-[var(--lg-gold)] underline underline-offset-4">
              iShield
            </Link>{" "}
            ซึ่งจ่ายตั้งแต่ระยะเริ่มต้น ราคาบนหน้านี้เป็นของสัญญาหลักอย่างเดียว
          </Fold>
        </div>
      </div>
    </section>
  );
}

export function Disclaimer({ facts }: { facts: LifeTreasureCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <p className="pt-8 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        ไลฟ์เทรเชอร์เป็นชื่อทางการตลาด ชื่อแบบประกันภัยที่ปรากฏในกรมธรรม์คือ ไลฟ์เรดดี้ (ไม่มีเงินปันผล)
      </p>
      <p className="pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-75">
        ตัวเลขบนหน้านี้เป็นเบี้ยมาตรฐานจากตารางอัตราเบี้ยฉบับ {facts.rateVersion} ใช้เพื่อประกอบการตัดสินใจเบื้องต้น
        ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์
        ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไข ความคุ้มครอง และข้อยกเว้นก่อนตัดสินใจทำประกันภัยทุกครั้ง
      </p>
    </footer>
  );
}
