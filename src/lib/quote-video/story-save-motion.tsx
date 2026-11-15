import { a, type Anim } from "./motion";
import type { SaveShow } from "./story-knowledge";

/**
 * ออมเงินและเกษียณ (device round 4, spec 2026-11-15-devices-saving-design.md): the four saving devices' timing, which
 * kspec hands on. savejar fills in four steps, paidgot grows its two bars in turn, pricerise shows the baskets and
 * fades two goods, pensionsteps raises one step for each row and draws the cost-of-living line over them. The drawers
 * (showBody, the info route) come with Tasks 2-4.
 */
export function saveSpec(show: SaveShow): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "savejar":
      // the jar; it fills in four steps, each marked with its year; the card under it
      s.set = a(0.5, "pop");
      for (let i = 0; i < 4; i++) s[`fill${i}`] = a(1.0 + i * 0.5, "grow", 0.45);
      s.card = a(3.1, "pop");
      break;
    case "paidgot":
      // two bars to one scale, in turn: what was paid, then what comes back
      s.paid = a(0.6, "grow", 0.9);
      s.got = a(1.7, "grow", 0.9);
      s.foot = a(2.8, "fade");
      break;
    case "pricerise":
      // today's basket, the same banknote later, two goods fade out, the red line
      s.today = a(0.5, "pop");
      s.later = a(1.2, "pop");
      s.fade = a(2.0, "fade", 0.8);
      s.line = a(2.9, "pop");
      break;
    case "pensionsteps":
      // one step at a time, then the line for the cost of living drawn over them
      s.set = a(0.4, "fade", 0.3);
      show.rows.forEach((_, i) => { s[`step${i}`] = a(0.6 + i * 0.45, "grow", 0.4); });
      s.living = a(0.9 + show.rows.length * 0.45, "stroke", 1.0);
      s.caption = a(1.0 + show.rows.length * 0.45, "fade");
      break;
  }
  const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
  s.note = a(end + 0.2, "fade");
  return s;
}
