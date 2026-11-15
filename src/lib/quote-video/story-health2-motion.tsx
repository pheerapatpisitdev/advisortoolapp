import { a, type Anim } from "./motion";
import type { Health2Show } from "./story-knowledge";

/**
 * สุขภาพเพิ่มเติม (device round 5, spec 2026-11-15-devices-health2-design.md): the eight devices' timing, which kspec hands
 * on. ipdopd opens its two doors in turn, deductible grows its bill bar in two parts, copay splits its sheet, renew98 draws
 * the timeline and its arc, parentshealth shows the parents then the child, groupcost the six people and two cards,
 * hospitals one bar a province, paclaim its cards in turn. The drawers (showBody, the info route) come with Tasks 2-4.
 */
export function health2Spec(show: Health2Show): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "ipdopd":
      // the blue door (ผู้ป่วยใน) opens and its card follows; then the green door (ผู้ป่วยนอก) and its card; the line last
      s.door0 = a(0.5, "pop");
      s.card0 = a(1.0, "pop");
      s.door1 = a(1.8, "pop");
      s.card1 = a(2.3, "pop");
      s.line = a(3.1, "fade");
      break;
    case "deductible":
      // the bill bar; our part (gold), then the insurer's (green); the card
      s.bill = a(0.5, "grow", 0.7);
      s.ours = a(1.3, "grow", 0.6);
      s.theirs = a(2.0, "grow", 0.6);
      s.card = a(2.8, "pop");
      break;
    case "copay":
      // the bill sheet, the dashed red line across it, our share, the insurer's, the card
      s.sheet = a(0.5, "pop");
      s.cut = a(1.2, "stroke", 0.6);
      s.ours = a(1.9, "pop");
      s.theirs = a(2.4, "pop");
      s.card = a(3.0, "pop");
      break;
    case "renew98":
      // the timeline, today's mark, the dashed arc to the renewal age, the two cards
      s.line = a(0.5, "stroke", 0.8);
      s.today = a(1.0, "pop");
      s.arc = a(1.5, "stroke", 0.9);
      s.to = a(2.3, "pop");
      s.card = a(2.9, "pop");
      break;
    case "parentshealth":
      // the two parents, the child who pays, the card, the foot
      s.parents = a(0.5, "pop");
      s.child = a(1.2, "pop");
      s.card = a(1.9, "pop");
      s.foot = a(2.8, "fade");
      break;
    case "groupcost":
      // six people, then the year's cost and the month's
      s.people = a(0.5, "pop");
      s.year = a(1.4, "pop");
      s.month = a(2.2, "pop");
      break;
    case "hospitals":
      // one bar for each province, to one scale from zero; the foot and the line after
      show.rows.forEach((_, i) => { s[`bar${i}`] = a(0.6 + i * 0.4, "grow", 0.6); });
      s.foot = a(0.8 + show.rows.length * 0.4, "fade");
      s.line = a(1.1 + show.rows.length * 0.4, "fade");
      break;
    case "paclaim":
      // what one accident's treatment may cost at most; then, when the plan has it, the weekly sum and its weeks
      s.medical = a(0.5, "pop");
      s.weekly = a(1.4, "pop");
      s.weeks = a(2.1, "pop");
      break;
  }
  const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
  s.note = a(end + 0.2, "fade");
  return s;
}
