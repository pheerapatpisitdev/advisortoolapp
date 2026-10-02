import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { PlbCopyFacts } from "@/lib/plb-facts";

/**
 * The pitch, straight after the price. Two rows, and the second one is the bad news — a
 * contract this short is only worth buying by someone who has understood that half of it,
 * and a customer who reads it here does not discover it in year six.
 */
export function WhatItPaysSection({ facts }: { facts: PlbCopyFacts }) {
  const { example } = facts;
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ทุน {example.sumShort} สัญญาเดียว</span>
        <br />
        <span className="lg-metal-text">บอกได้สองข้อ จบ</span>
      </h2>

      <dl className="relative mt-7 space-y-5">
        <div className="border-b border-[var(--lg-panel-line)] pb-5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-medium text-[var(--lg-white)]">เสียชีวิตระหว่างสัญญา</dt>
            <dd className="lg-figure shrink-0 text-lg tabular-nums text-[var(--lg-gold)]">{example.sum} บาท</dd>
          </div>
          <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
            ทุกสาเหตุ ตามเงื่อนไขกรมธรรม์ · ครอบครัวรับเป็นเงินก้อน ใช้ปิดหนี้ ส่งลูกเรียน
            หรืออะไรก็ได้
          </p>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-medium text-[var(--lg-white)]">อยู่ครบสัญญา</dt>
            <dd className="shrink-0 text-sm text-[var(--lg-mute)]">ไม่มีเงินคืน</dd>
          </div>
          <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
            แบบนี้ไม่สะสมมูลค่า ไม่มีเงินครบสัญญา ความคุ้มครองสิ้นสุดตามกำหนด —
            และนั่นคือเหตุผลที่เบี้ยถูกกว่าแบบอื่นหลายเท่าบนทุนเท่ากัน
          </p>
        </div>
      </dl>

      <p className="relative mt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        ตัวอย่างบนทุน {example.sum} บาท
      </p>
    </section>
  );
}

/** Why buy cover that ends — and the one figure on the page nobody else shows. */
export function WhySection({ facts }: { facts: PlbCopyFacts }) {
  const points = [
    {
      title: "ซื้อทุนให้พอ ไม่ใช่ซื้อเท่าที่เบี้ยไหว",
      body: "หนี้บ้านเป็นล้าน ค่าเรียนลูกเป็นล้าน แต่ทุนประกันที่หลายคนมีอยู่คือหลักแสน "
        + "แบบคุ้มครองล้วนทำให้ทุนหลักล้านอยู่ในงบที่จ่ายไหวจริง",
    },
    {
      title: "เลือกความยาวให้ตรงกับภาระ",
      body: "ผ่อนบ้านเหลืออีก 12 ปี ก็เลือก 12 ปี ลูกเรียนอีก 15 ปีก็เลือก 15 ปี "
        + "จ่ายเท่าที่ต้องคุ้ม ไม่ต้องจ่ายยาวไปกว่าวันที่ครอบครัวยืนได้เอง",
    },
    facts.scale
      ? {
        title: `ทุนยิ่งสูง เบี้ยต่อล้านยิ่งถูก`,
        body: `บริษัทลดอัตราเบี้ยให้ตามขนาดทุน สูงสุด ${facts.discount.perThousand} บาทต่อพัน `
          + `ตั้งแต่ทุน ${facts.discount.fromSumShort}ขึ้นไป — ${facts.scale.termLabel} `
          + `ทุน ${facts.scale.small.sumShort}คิดเป็นล้านละ ${facts.scale.small.perMillion} บาทต่อปี `
          + `แต่ทุน ${facts.scale.big.sumShort}เหลือล้านละ ${facts.scale.big.perMillion} บาท `
          + `ถูกลงราว ${facts.scale.savedPercent}%`,
      }
      : {
        title: "ทุนยิ่งสูง เบี้ยต่อล้านยิ่งถูก",
        body: `บริษัทลดอัตราเบี้ยให้ตามขนาดทุน สูงสุด ${facts.discount.perThousand} บาทต่อพัน `
          + `ตั้งแต่ทุน ${facts.discount.fromSumShort}ขึ้นไป ทักมาขอราคาปัจจุบันได้`,
      },
    {
      title: "เบี้ยเท่าเดิมทุกปี จ่ายมีวันจบ",
      body: "ล็อกที่อายุ ณ วันที่ทำ ไม่ปรับขึ้นตามอายุระหว่างสัญญา "
        + "และเมื่อครบกำหนดชำระก็คือจบ ไม่มีเบี้ยตามมาอีก",
    },
  ];
  return (
    <section className="py-12">
      <H2>ทำไมถึงเลือกแบบที่ไม่มีเงินคืน</H2>
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

/** The four terms side by side, on one arrangement, so the choice is a comparison. */
export function TermsSection({ facts }: { facts: PlbCopyFacts }) {
  const { example } = facts;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คุ้มครองกี่ปีดี</H2>
        <p className="mt-2 text-sm text-[var(--lg-mute)]">
          {example.sex === "M" ? "ชาย" : "หญิง"} {example.age} ปี · ทุน {example.sum} บาท
        </p>
        <div className="mt-7 space-y-6">
          {example.terms.map((t) => (
            <div key={t.label} className="border-b border-[var(--lg-panel-line)] pb-5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium text-[var(--lg-white)]">คุ้มครอง {t.years} ปี</div>
                {t.premium && (
                  <div className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                    {t.premium} <span className="text-sm text-[var(--lg-mute)]">บาท{t.per}</span>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
                จ่าย {t.years} ปี{t.total ? <> รวมทั้งหมด {t.total} บาท</> : null} คุ้มครองถึงอายุ {t.endsAtAge}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
          เลือกจากวันที่ครอบครัวยืนได้เอง ไม่ใช่จากเบี้ยที่ถูกที่สุด — ทุนหมดก่อนหนี้หมด
          คือสิ่งเดียวที่แบบนี้พลาดได้
        </p>
      </div>
    </section>
  );
}

/**
 * Who should not buy this. A page that names the customer it is wrong for is a page the
 * right customer believes — and the two plans named here are the agency's own, so a visitor
 * who came to the wrong page still lands somewhere useful.
 */
export function NotForYouSection() {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>แบบนี้ไม่เหมาะกับใคร</H2>
        <div className="mt-7 space-y-6">
          <div>
            <div className="font-medium text-[var(--lg-white)]">อยากได้เงินคืน อยากให้เป็นเงินออม</div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
              แบบนี้ตอบไม่ได้เลย ถ้าต้องการทั้งคุ้มครองและมีมูลค่าสะสม{" "}
              <Link href="/lifeprotect" className="text-[var(--lg-gold)] underline underline-offset-4">
                ดู Life Protect x 2
              </Link>{" "}
              ซึ่งคุ้มครองถึงอายุ 99 และมีมูลค่าเวนคืนทุกปี
            </p>
          </div>
          <div>
            <div className="font-medium text-[var(--lg-white)]">กลัวป่วยหนักมากกว่ากลัวจากไป</div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
              แบบนี้จ่ายเมื่อเสียชีวิตเท่านั้น ไม่จ่ายตอนป่วย ถ้าสิ่งที่กลัวคือวันที่หมอบอกว่าเป็นโรคร้ายแรง{" "}
              <Link href="/ishield" className="text-[var(--lg-gold)] underline underline-offset-4">
                ดู iShield
              </Link>{" "}
              ซึ่งจ่ายเป็นเงินก้อนตั้งแต่ระยะเริ่มต้น
            </p>
          </div>
          <div>
            <div className="font-medium text-[var(--lg-white)]">ต้องการค่าห้องค่ารักษา</div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
              สัญญาหลักตัวนี้ไม่ใช่ประกันสุขภาพ แต่พ่วงสัญญาเพิ่มเติมค่ารักษาและอุบัติเหตุได้
              ทักมาคุยกันก่อนได้ว่าต้องพ่วงอะไรบ้าง
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The objections, answered before they are raised. */
export function FaqSection({ facts }: { facts: PlbCopyFacts }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คำถามที่พบบ่อย</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          <Fold summary="จ่ายครบแล้วได้เงินคืนไหม">
            ไม่ได้ครับ แบบนี้เป็นความคุ้มครองล้วน ไม่มีเงินครบสัญญาและไม่สะสมมูลค่า
            เบี้ยทั้งหมดเป็นค่าความคุ้มครอง เหมือนที่เราจ่ายประกันรถทุกปีโดยไม่ได้คืน
            ข้อแลกเปลี่ยนคือทุนที่สูงกว่าแบบมีเงินคืนมากบนเบี้ยเท่ากัน
          </Fold>
          <Fold summary="คุ้มครองกี่ปี แล้วหมดแล้วทำต่อได้ไหม">
            คุ้มครองเท่ากับจำนวนปีที่ชำระ — 5 10 12 หรือ 15 ปี ครบแล้วสัญญาสิ้นสุด
            ถ้ายังต้องการความคุ้มครองต่อ ต้องทำฉบับใหม่ตามอายุและสุขภาพ ณ ตอนนั้น
            ซึ่งเบี้ยจะสูงขึ้นตามอายุ จึงควรเลือกความยาวให้ครอบคลุมภาระตั้งแต่แรก
          </Fold>
          <Fold summary="เบี้ยขึ้นทุกปีไหม">
            ไม่ขึ้นครับ เบี้ยล็อกที่อายุ ณ วันที่ทำ และเท่าเดิมตลอดสัญญา
            เลือกชำระรายปี ราย 6 เดือน หรือรายเดือนก็ได้ รายเดือนมีขั้นต่ำรวมทุกสัญญา
            เดือนละ 1,000 บาท
          </Fold>
          <Fold summary="อายุเท่าไรทำได้ และทุนเท่าไร">
            รับอายุ {facts.ageMin} ถึง {facts.ageMax} ปี ทุนประกันตั้งแต่ {facts.saMin} บาทขึ้นไป
            เครื่องคำนวณด้านบนเลื่อนได้ถึง {facts.saMax} บาท ถ้าต้องการมากกว่านั้นทักมาคุยได้
          </Fold>
          <Fold summary="เสียชีวิตจากอุบัติเหตุได้เพิ่มไหม">
            สัญญาหลักจ่ายเต็มทุนทุกสาเหตุเท่ากัน ถ้าต้องการให้กรณีอุบัติเหตุได้เพิ่ม
            พ่วงสัญญาเพิ่มเติมอุบัติเหตุได้ ซึ่งจะเพิ่มทุนเฉพาะกรณีอุบัติเหตุขึ้นไปอีก
            ราคาบนหน้านี้เป็นของสัญญาหลักอย่างเดียว
          </Fold>
          <Fold summary="ลดหย่อนภาษีได้ไหม">
            ได้ครับ เป็นเบี้ยประกันชีวิตที่ใช้สิทธิลดหย่อนได้ตามที่จ่ายจริง
            ไม่เกินเพดานที่กรมสรรพากรกำหนด และเป็นไปตามเงื่อนไขของประกาศอธิบดีกรมสรรพากร
          </Fold>
        </div>
      </div>
    </section>
  );
}

export function Disclaimer({ facts }: { facts: PlbCopyFacts }) {
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
