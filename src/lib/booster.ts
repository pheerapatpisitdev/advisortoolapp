/**
 * Whether a year's cover is the x2 booster: exactly twice the sum the cover settles to once
 * the booster is past (the projection's coverFloor). The x1.5 years are not marked (owner,
 * 2026-10-10: x2 only). Its own module so the page's table can use it without the card's.
 */
export function isBooster(cover: number, floor: number): boolean {
  return floor > 0 && cover === floor * 2;
}
