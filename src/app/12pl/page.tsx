import { gateCalc } from "@/lib/auth/viewer";
import { hiddenOnPage } from "@/lib/pay-prefs-store";
import { getPlan } from "@/calc/plans/registry";
import { TwelvePlCalculator } from "@/components/TwelvePlCalculator";
import { twelvePlTable } from "@/lib/twelvepl-table";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer } from "@/components/twelvepl/Sections";

export const metadata = {
  title: "12 พีแอล (12PL) — ชำระ 12 ปี คุ้มครองถึง 85 มีเงินคืนทุกปี",
  description:
    "ประกันชีวิตแบบมีเงินปันผล ชำระเบี้ย 12 ปี คุ้มครองถึงอายุ 85 เงินคืนทุกปีตั้งแต่ปีที่ 2 ครบกำหนดรับ 115% ของทุน คำนวณเบี้ยและผลประโยชน์ได้ทันที",
};

/** 12 พีแอล (owner, 2026-11-18, ก ก ก): the plan's facts, the calculator, and the legal lines. */
export default async function TwelvePlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await gateCalc("/12pl");
  const hide = await hiddenOnPage(viewer, await searchParams);
  const table = twelvePlTable();
  const rates = getPlan(table.planCode)!.rates;
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle
        name="12PL"
        kind="ประกันชีวิตแบบมีเงินปันผล"
        facts={["จ่าย 12 ปี", `คุ้มครองถึงอายุ ${table.coverToAge}`, `รับแรกเกิด–${table.ageMax} ปี`, "ทุนเริ่ม 1 แสน"]}
      />
      <section id="calc" className="scroll-mt-4">
        <TwelvePlCalculator table={table} hide={hide} sticky />
      </section>
      <Disclaimer expired={table.expired} rateVersion={table.rateVersion} salesPeriod={rates.effectiveText ?? ""} />
    </main>
  );
}
