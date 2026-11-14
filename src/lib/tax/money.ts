/** "1,200,000" → 1200000; ข้อความว่าง ไม่ใช่ตัวเลข หรือติดลบ → 0 */
export function parseMoney(text: string): number {
  const cleaned = String(text ?? '').replace(/[,\s]/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 1200000 → "1,200,000"; 3050.5 → "3,050.50" */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const hasFraction = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}
