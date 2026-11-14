import { gateCalc } from "@/lib/auth/viewer";
import { PACalculator } from "@/components/PACalculator";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Rule } from "@/components/sales/Blocks";

export const metadata = {
  title: "PA — ประกันอุบัติเหตุส่วนบุคคล",
  description:
    "PA Classic, PA Platinum และ PA Max คุ้มครองอุบัติเหตุ 24 ชั่วโมงทั่วโลก เลือกแผนและขั้นอาชีพ ดูเบี้ยรายปีได้ทันที",
};

/**
 * Krungthai-AXA's Personal Accident plans (owner, 2026-11-14, ก ก ก on mockup
 * https://claude.ai/artifact/6RyRCubLaap2YinJGpnzcm): the calculator, every plan of the family
 * in one table, and the copied text. Picture card, bot and clip come in a later round.
 */
export default async function PaPage() {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/pa");
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="PA" kind="ประกันอุบัติเหตุส่วนบุคคล" facts={["คุ้มครอง 24 ชม. ทั่วโลก", "สัญญาปีต่อปี", "เบี้ยตามขั้นอาชีพ"]} />
      <section id="calc" className="scroll-mt-4">
        <PACalculator sticky />
      </section>
      <footer className="pb-10">
        <Rule />
        <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
          <p>
            (1) เพิ่มจำนวนเงินเอาประกันภัยในปีต่ออายุ ปีละ 5% ของจำนวนเงินเอาประกันภัยตั้งต้น ตั้งแต่ปีกรมธรรม์ที่ 2–6
            รวมสูงสุด 25% ต่ออายุได้ภายใน 31 วันหลังวันครบกำหนดโดยยังได้สิทธิ์เพิ่ม 5% แต่ไม่ได้รับความคุ้มครองในช่วงนั้น
            ความคุ้มครองใหม่เริ่มวันที่ชำระเบี้ยต่ออายุ หากชำระเกินช่วงดังกล่าวถือเป็นการซื้อกรมธรรม์ใหม่และไม่ได้รับสิทธิ์เพิ่ม 5%
          </p>
          <p className="mt-2.5">
            สัญญาประกันภัยมีระยะเวลา 1 ปี ต่ออายุได้ปีต่อปี เบี้ยประกันภัยกำหนดตามลักษณะการประกอบอาชีพ
            ผู้ขอเอาประกันภัยมีหน้าที่แถลงข้อความจริง การปกปิดหรือแถลงเท็จอาจทำให้บริษัทบอกล้างสัญญาและปฏิเสธการจ่ายค่าสินไหมทดแทนได้
          </p>
          <p className="mt-2.5 font-medium text-[var(--lg-white)]">
            ข้อมูลนี้เป็นข้อมูลเบื้องต้นเพื่อประกอบการนำเสนอเท่านั้น ผู้ขอเอาประกันภัยควรศึกษาและทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
          </p>
        </div>
      </footer>
    </main>
  );
}
