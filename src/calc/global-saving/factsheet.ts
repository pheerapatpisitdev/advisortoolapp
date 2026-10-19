/**
 * Citi Grandmaster RC 5 Index, the index Global Savings Plus 15/8's bonus follows — from the
 * index's own fact sheet as the owner's calculator carried it (owner, 2026-10-20: keep it under
 * the calculator). Returns are % a year before the plan's participation rate; those before
 * May 2565 (2022) are a back-test.
 */

export const INDEX_NAME = "Citi Grandmaster RC 5 Index";
export const INDEX_LINK = "https://www.krungthai-axa.co.th/th/products/performance/global-saving-plus-15-8";

/** the fact sheet's headline figures */
export const INDEX_METRICS = { avgReturn: 4.15, avgVolatility: 4.08, sharpe: 1.02 };

/** the series starts at 100 points at the end of this Buddhist year */
export const INDEX_BASE_YEAR = 2545;

export const INDEX_ANNUAL_RETURNS: Record<number, number> = {
  2546: 7.87, 2547: 6.2, 2548: 6.36, 2549: 4.07, 2550: 5.22, 2551: 3.66, 2552: 0.97,
  2553: 5.58, 2554: 2.48, 2555: 6.23, 2556: 9.81, 2557: 5.62, 2558: -5.33, 2559: 5.51,
  2560: 7.45, 2561: 0.59, 2562: 11.58, 2563: 5.89, 2564: 2.42, 2565: -3.21, 2566: 3.31,
  2567: -0.16, 2568: 5.77,
};

export interface AllocationItem { th: string; en: string; pct: number }
export interface AllocationGroup { name: string; items: AllocationItem[] }

/** average weights, Jan 2548 – Apr 2569 */
export const INDEX_ALLOCATION: AllocationGroup[] = [
  { name: "หุ้น", items: [
    { th: "หุ้นสหรัฐฯ", en: "US Equity", pct: 16.68 },
    { th: "หุ้นยุโรป", en: "Eurozone Equity", pct: 8.33 },
    { th: "หุ้นญี่ปุ่น", en: "Japan Equity", pct: 2.78 }] },
  { name: "พันธบัตรรัฐบาล", items: [
    { th: "พันธบัตรรัฐบาลสหรัฐฯ", en: "US Gov Bond", pct: 20.08 },
    { th: "พันธบัตรรัฐบาลยุโรป", en: "EU Gov Bond", pct: 20.08 },
    { th: "พันธบัตรรัฐบาลญี่ปุ่น", en: "Japan Gov Bond", pct: 10.04 }] },
  { name: "ตราสารหนี้เอกชน", items: [
    { th: "ตราสารหนี้เอกชน", en: "Corporate Credit", pct: 11.37 }] },
  { name: "โภคภัณฑ์", items: [
    { th: "สินค้าโภคภัณฑ์อื่น", en: "Other Commodities", pct: 7.09 },
    { th: "โลหะมีค่า", en: "Precious Metals", pct: 3.54 }] },
];

/** the stretches the line chart shades */
export const INDEX_EVENTS = [
  { from: 2557, to: 2558, text: "วิกฤตหนี้กรีซ และจุดเปลี่ยนดอกเบี้ยสหรัฐฯ" },
  { from: 2563, to: 2563, text: "ช่วงสถานการณ์โควิด" },
  { from: 2565, to: 2565, text: "ตลาดผันผวนตามทิศทางดอกเบี้ยสหรัฐฯ" },
];

/** the index level at the end of each year, from 100 at the base year, compounding the returns above */
export function indexLevels(): { year: number; level: number }[] {
  const years = Object.keys(INDEX_ANNUAL_RETURNS).map(Number).sort((a, b) => a - b);
  const out = [{ year: INDEX_BASE_YEAR, level: 100 }];
  let v = 100;
  for (const y of years) {
    v *= 1 + INDEX_ANNUAL_RETURNS[y] / 100;
    out.push({ year: y, level: v });
  }
  return out;
}
