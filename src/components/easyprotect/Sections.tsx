import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { EasyProtectCopyFacts } from "@/lib/easyprotect-facts";

/**
 * The pitch, straight after the price: what the contract pays, and the two floors under it
 * that mean it never hands back less than what went in.
 */
export function WhatItPaysSection({ facts }: { facts: EasyProtectCopyFacts }) {
  const { example } = facts;
  const ways = [
    {
      what: "เสียชีวิต ไม่ว่าปีไหน",
      amount: example.sum,
      note: `เต็มทุนทุกช่วงอายุ จนถึงอายุ ${facts.coverToAge} · ผู้รับประโยชน์ได้เป็นเงินก้อน ตามสัดส่วนที่คุณระบุไว้`,
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
        <span className="text-[var(--lg-mute)]">จ่าย {facts.payYears} ปี แลกกับ</span>
        <br />
        <span className="lg-metal-text">สัญญาที่ไม่มีวันหมดอายุก่อนคุณ</span>
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

/** Why a plan with an end to its premiums, rather than one paid for life. */
export function WhySection({ facts }: { facts: EasyProtectCopyFacts }) {
  const points = [
    {
      title: `ภาระที่รู้จุดจบ — ${facts.payYears} ครั้ง`,
      body: "ประกันตลอดชีพส่วนใหญ่ผูกเบี้ยไว้กับคุณจนถึงอายุ 90 กว่า "
        + `แบบนี้นับได้ตั้งแต่วันแรกว่าจ่ายอีกกี่ครั้ง ครบ ${facts.payYears} ปีแล้วกรมธรรม์เดินต่อเอง `
        + "เหมาะกับคนที่รายได้ดีช่วงนี้ แต่ไม่อยากผูกรายจ่ายยาวไปถึงวัยเกษียณ",
    },
    {
      title: "เบี้ยล็อกที่อายุวันที่ทำ",
      body: "เบี้ยคิดจากอายุ ณ วันที่ทำสัญญา แล้วเท่าเดิมทุกปีจนครบกำหนดชำระ "
        + "ต่างจากแบบที่เบี้ยขยับตามอายุทุกปี ซึ่งแพงขึ้นเรื่อย ๆ ตอนที่เราต้องใช้มันที่สุด "
        + "ทำเร็วกว่าหนึ่งปีคือถูกกว่าทั้งสัญญา",
    },
    {
      title: "เงินไม่ได้หายไปกับเบี้ย",
      body: "มูลค่าเวนคืนโตขึ้นทุกปีตามตารางในกรมธรรม์ ระหว่างทางใช้เป็นหลักประกันกู้ตามเงื่อนไขได้ "
        + `และถ้าอยู่ถึงอายุ ${facts.coverToAge} มูลค่านั้นเท่ากับทุนประกันเต็มจำนวน `
        + "จึงไม่ใช่เบี้ยทิ้งแบบประกันคุ้มครองล้วน",
    },
    {
      title: "ทุนเริ่มต้นที่เอื้อมถึง",
      body: `ทุนขั้นต่ำ ${facts.saMin} บาท ไม่ได้ออกแบบมาสำหรับคนมีมรดกก้อนใหญ่เท่านั้น `
        + `เครื่องคำนวณด้านบนเลื่อนได้ถึง ${facts.saMax} บาท จะเริ่มเล็กแล้วค่อยเพิ่มฉบับทีหลังก็ได้`,
    },
  ];
  return (
    <section className="py-12">
      <H2>ทำไมต้องเป็นแบบที่จ่ายสั้น</H2>
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
 * Three ages side by side on the same sum assured.
 *
 * Where ไลฟ์เทรเชอร์ compares terms, this plan has only one — so the comparison that is
 * worth a reader's time is the one they can still act on: today's age against the one they
 * will be if they think about it for ten years. The column they are really reading is the
 * total, and beside it the multiple, which is what the six years actually buy.
 */
export function AgesSection({ facts }: { facts: EasyProtectCopyFacts }) {
  const { example } = facts;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>เริ่มตอนอายุเท่าไร ต่างกันแค่ไหน</H2>
        <p className="mt-2 text-sm text-[var(--lg-mute)]">
          ทุน {example.sum} บาท · {example.sex === "M" ? "ชาย" : "หญิง"} · จ่าย {facts.payYears} ปีเท่ากันทุกช่อง
        </p>

        <div className="mt-6 overflow-hidden rounded-sm border border-[var(--lg-hair)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--lg-panel)] text-left text-[var(--lg-mute)]">
                <th scope="col" className="px-4 py-3 font-medium">อายุที่เริ่ม</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">เบี้ย</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">รวม {facts.payYears} ปี</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">คุ้มครองเป็น</th>
              </tr>
            </thead>
            <tbody>
              {example.ages.map((row) => (
                <tr key={row.age} className="border-t border-[var(--lg-panel-line)]">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[var(--lg-white)]">
                    {row.age} ปี
                  </th>
                  {/* the instalment and what it is per, stacked: on a phone the two together
                      wrap mid-figure, and a premium broken across lines reads as two numbers */}
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--lg-white)]">
                    {row.premium ?? "—"}
                    {row.premium && (
                      <span className="block text-xs text-[var(--lg-mute)]">{row.per}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--lg-white)]">
                    {row.total ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--lg-gold)]">
                    {row.leverage ? `${row.leverage} เท่า` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
          ทุนเท่ากัน ความคุ้มครองเท่ากัน ต่างกันแค่ปีที่เริ่ม —
          และตัวเลขที่ต่างคือเบี้ยที่ต้องจ่ายตลอดทั้งสัญญา
          เลื่อนทุนในเครื่องคำนวณด้านบนเพื่อดูของอายุคุณเอง
        </p>
      </div>
    </section>
  );
}

/** What the contract is worth while it is still running — the objection, answered with the table. */
export function GrowthSection({ facts }: { facts: EasyProtectCopyFacts }) {
  const { growth } = facts;
  if (!growth) return null;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>ระหว่างทาง เงินอยู่ไหน</H2>
        <p className="mt-2 text-sm leading-[1.85] text-[var(--lg-mute)]">
          ตัวอย่าง: ทุน {facts.example.sum} บาท {facts.example.sex === "M" ? "ชาย" : "หญิง"} อายุ {growth.age} ปี
        </p>

        <div className="mt-6 space-y-5">
          {growth.breakEvenAge !== null && (
            <div>
              <div className="font-medium text-[var(--lg-white)]">
                ปีที่ {growth.breakEvenYear} (อายุ {growth.breakEvenAge}) มูลค่าเวนคืนแซงเบี้ยที่จ่ายไป
              </div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
                หลังจากปีนั้น ถ้าเวนคืนกรมธรรม์จะได้คืนมากกว่าเบี้ยทั้งหมดที่ใส่เข้าไป
                โดยที่ระหว่างทางก็คุ้มครองมาตลอด
              </p>
            </div>
          )}
          {growth.at60 && (
            <div>
              <div className="font-medium text-[var(--lg-white)]">อายุ 60 มีมูลค่า {growth.at60} บาท</div>
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
              เท่ากับทุนประกันเต็มจำนวน — อยู่ครบสัญญาก็ได้เท่าที่ตั้งใจจะคุ้มครองไว้
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
export function FaqSection({ facts }: { facts: EasyProtectCopyFacts }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คำถามที่พบบ่อย</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          <Fold summary={`จ่ายครบ ${facts.payYears} ปีแล้วต้องจ่ายอะไรอีกไหม`}>
            สัญญาหลักไม่มีเบี้ยตามมาอีกครับ ครบ {facts.payYears} ปีแล้วความคุ้มครองเดินต่อถึงอายุ {facts.coverToAge}
            โดยไม่ต้องชำระเพิ่ม ยกเว้นกรณีที่พ่วงสัญญาเพิ่มเติม เช่น ค่ารักษาพยาบาลหรือโรคร้ายแรง
            ซึ่งเป็นสัญญาปีต่อปี ต้องต่ออายุและชำระเบี้ยของส่วนนั้นทุกปีแยกจากสัญญาหลัก
          </Fold>
          <Fold summary="ถ้าเสียชีวิตในปีแรก ๆ ได้เต็มทุนเลยไหม">
            ได้ครับ ทุนประกันจ่ายเต็มจำนวนทุกช่วงอายุตลอดสัญญา ไม่ลดหลั่นตามปีที่ถือ
            ทั้งที่เบี้ยเพิ่งจ่ายไปไม่กี่ปี ทั้งนี้เป็นไปตามเงื่อนไขและข้อยกเว้นในกรมธรรม์
            เช่น กรณีฆ่าตัวตายหรือถูกผู้รับประโยชน์ฆ่าภายในระยะเวลาที่กรมธรรม์กำหนด
          </Fold>
          <Fold summary="เบี้ยขึ้นตามอายุทุกปีไหม">
            ไม่ขึ้นครับ เบี้ยล็อกที่อายุ ณ วันที่ทำ และเท่าเดิมตลอด {facts.payYears} ปีที่ชำระ
            ตารางเปรียบเทียบด้านบนแสดงให้เห็นว่าเริ่มช้าไปสิบปี เบี้ยรวมต่างกันเท่าไร
          </Fold>
          <Fold summary="จ่ายไม่ไหวกลางคัน ทำอย่างไร">
            มีทางเลือกตามเงื่อนไขกรมธรรม์ ทั้งเวนคืนรับมูลค่าเงินสด กู้ชำระเบี้ยอัตโนมัติ
            หรือแปลงเป็นกรมธรรม์ใช้เงินสำเร็จ ซึ่งลดทุนลงแต่ไม่ต้องจ่ายเบี้ยอีก
            ตารางมูลค่าทุกปีอยู่ในเครื่องคำนวณด้านบน ทักมาคุยก่อนตัดสินใจได้เสมอ
          </Fold>
          <Fold summary="อายุเท่าไรทำได้ และทุนสูงสุดเท่าไร">
            รับตั้งแต่แรกเกิดถึงอายุ {facts.ageMax} ปี ทุนขั้นต่ำ {facts.saMin} บาท
            เครื่องคำนวณด้านบนเลื่อนทุนได้ถึง {facts.saMax} บาท ถ้าต้องการมากกว่านั้นทักมาคุยได้
            ทุนสูง ๆ บริษัทจะมีขั้นตอนพิจารณาสุขภาพและฐานะการเงินเพิ่มเติม
          </Fold>
          <Fold summary="ลดหย่อนภาษีได้ไหม">
            ได้ครับ เป็นเบี้ยประกันชีวิตที่ใช้สิทธิลดหย่อนได้ตามที่จ่ายจริง
            ไม่เกินเพดานที่กรมสรรพากรกำหนด และเป็นไปตามเงื่อนไขของประกาศอธิบดีกรมสรรพากร
          </Fold>
          <Fold summary="พ่วงค่ารักษาพยาบาลหรือโรคร้ายแรงได้ไหม">
            ได้ครับ สัญญาหลักตัวนี้จ่ายเมื่อเสียชีวิต ถ้าต้องการค่ารักษาแบบเหมาจ่ายพ่วง{" "}
            <Link href="/ihealthy-ultra" className="text-[var(--lg-gold)] underline underline-offset-4">
              iHealthy Ultra
            </Link>{" "}
            ได้ หรือถ้าอยากได้เงินก้อนตอนตรวจพบโรคร้ายแรงตั้งแต่ระยะเริ่มต้น ดู{" "}
            <Link href="/ishield" className="text-[var(--lg-gold)] underline underline-offset-4">
              iShield
            </Link>{" "}
            ราคาบนหน้านี้เป็นของสัญญาหลักอย่างเดียว
          </Fold>
          <Fold summary={`อยากได้ทุนสูงกว่านี้ หรือทุนหลักสิบล้าน`}>
            ทุนระดับสิบล้านขึ้นไปเพื่อการส่งต่อทรัพย์สิน{" "}
            <Link href="/lifetreasure" className="text-[var(--lg-gold)] underline underline-offset-4">
              ไลฟ์เทรเชอร์
            </Link>{" "}
            ออกแบบมาสำหรับงานนั้นโดยตรง และถ้าอยากได้ทุนคุ้มครองสูงในเบี้ยที่ต่ำกว่า{" "}
            <Link href="/lifeprotect" className="text-[var(--lg-gold)] underline underline-offset-4">
              Life Protect x 2
            </Link>{" "}
            จ่ายเป็นสองเท่าของทุนก่อนอายุ 60
          </Fold>
        </div>
      </div>
    </section>
  );
}

export function Disclaimer({ facts }: { facts: EasyProtectCopyFacts }) {
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
