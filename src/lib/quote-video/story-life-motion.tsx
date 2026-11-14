import { a, type Anim } from "./motion";
import { incomestopLost, lifeneedTotals, moneysplitRemainder, taxbackRefund, type LifeShow } from "./story-knowledge";
import { TAX_CAPS, TAX_RATES } from "@/lib/scene-library/tax-th";

/**
 * ชีวิต โรคร้าย ภาษี มรดก (device round 2, spec 2026-11-14-devices-life-tax-design.md): the eight devices'
 * timing, which kspec hands on. Their drawers join this file (Tasks 2–3, as story-health-motion.tsx's); a
 * figure counts up only where the inputs give it (the derived helpers in story-knowledge.ts), so a
 * words-only device has no count.
 */

/** the few things a device shows, in the order they come in */
export function lifeSpec(show: LifeShow): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "lifeneed": {
      const t = lifeneedTotals(show);
      if (!t.blocks.length) return { ...s, blocks: a(0.6, "pop"), words: a(1.4, "up") };
      t.blocks.forEach((_, i) => { s[`block${i}`] = a(0.6 + i * 0.4, "grow"); });
      const card = 0.9 + t.blocks.length * 0.4;
      s.need = a(card, "pop");
      s.count = a(card, "count");
      if (t.have !== undefined) s.have = a(card + 0.6, "left");
      if (t.gap !== undefined) s.gap = a(card + 1.1, "pop");
      return s;
    }
    case "beneficiary":
      s.policy = a(0.5, "pop");
      show.rows.forEach((_, i) => { s[`row${i}`] = a(0.9 + i * 0.35, "left"); });
      s.line = a(1.2 + show.rows.length * 0.35, "fade");
      return s;
    case "cilump":
      s.cert = a(0.5, "pop");
      s.arrow = a(0.9, "stroke", 0.5);
      s.cash = a(1.3, "pop");
      s.card = a(1.7, "pop");
      if (show.sum !== undefined) s.count = a(1.7, "count");
      s.line = a(2.4, "fade");
      if (show.note) s.note = a(2.7, "fade");
      return s;
    case "incomestop":
      s.income = a(0.5, "stroke", 1.0);
      s.gap = a(1.2, "pop");
      s.card = a(1.8, "pop");
      if (incomestopLost(show) !== undefined) s.count = a(1.8, "count");
      return s;
    case "taxback": {
      TAX_RATES.forEach((_, i) => { s[`rung${i}`] = a(0.5 + i * 0.2, "grow"); });
      const after = 0.7 + TAX_RATES.length * 0.2;
      if (show.bracket !== undefined) s.pick = a(after, "pop");
      if (taxbackRefund(show) !== undefined) {
        s.line = a(after + 0.4, "up");
        s.count = a(after + 0.4, "count");
      }
      return s;
    }
    case "taxcap":
      TAX_CAPS.forEach((_, i) => { s[`row${i}`] = a(0.5 + i * 0.4, "left"); });
      s.foot = a(0.7 + TAX_CAPS.length * 0.4, "fade");
      return s;
    case "moneysplit": {
      s.total = a(0.5, "pop");
      show.parts.forEach((_, i) => { s[`part${i}`] = a(1.0 + i * 0.35, "pop"); });
      const after = 1.1 + show.parts.length * 0.35;
      if (show.parts.length && show.parts.every((p) => p.amount !== undefined)) s.count = a(after, "count");
      if (moneysplitRemainder(show) !== undefined) s.left = a(after + 0.5, "fade");
      return s;
    }
    case "threegen":
      show.rows.forEach((_, i) => { s[`gen${i}`] = a(0.5 + i * 0.4, "pop"); });
      s.arrow = a(0.7, "stroke", 0.4 + show.rows.length * 0.4);
      if (show.note) s.note = a(1.0 + show.rows.length * 0.4, "fade");
      return s;
  }
}
