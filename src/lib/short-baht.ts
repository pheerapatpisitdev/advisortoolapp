/**
 * 650,000 → "6.5 แสน", 1,250,000 → "1.25 ล้าน": an amount short enough for a chart's axis, and
 * still the amount. The chart's one labelled line is the customer's own sum, and it was rounded
 * to whole แสน and one place of ล้าน — 650,000 read "7 แสน" beside a quote for 650,000 (review,
 * 2026-10-11). The same words as the sum buttons on the page.
 */
export function shortBaht(baht: number): string {
  if (baht >= 1_000_000) return `${+(baht / 1_000_000).toFixed(2)} ล้าน`;
  if (baht >= 100_000) return `${+(baht / 100_000).toFixed(1)} แสน`;
  return baht.toLocaleString("en-US");
}
