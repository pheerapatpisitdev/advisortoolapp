import { a, type Anim } from "./motion";
import type { MetaShow } from "./story-knowledge";

/**
 * อุปมาเล่าเรื่อง (device round 3, spec 2026-11-15-devices-metaphor-design.md): the eight metaphors' timing,
 * which kspec hands on. Each plays set -> trouble -> protection -> note; a metaphor carries words only, so there
 * is never a count. The drawers (showBody, the info route) come with Tasks 2-4.
 */
export function metaSpec(show: MetaShow): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "umbrella":
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade", 1.0);
      s.protect = a(1.9, "pop");
      break;
    case "housepillar":
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.8);
      // a second pillar only when a spare word is given: no spare, the shake alone
      if (show.spare) s.protect = a(2.1, "left");
      break;
    case "lifering":
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade", 1.0);
      s.protect = a(2.0, "stroke", 0.8);
      break;
    case "safetynet":
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.9);
      s.protect = a(2.0, "grow");
      break;
    case "seedtree":
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "grow");
      s.protect = a(1.9, "grow");
      break;
    case "balance":
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.8);
      s.protect = a(2.0, "pop");
      break;
    case "bridge":
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade");
      s.protect = a(1.7, "stroke", 1.0);
      break;
    case "shield":
      s.set = a(0.5, "pop");
      show.arrows.forEach((_, i) => { s[`arrow${i}`] = a(1.0 + i * 0.4, "left"); });
      s.protect = a(1.2 + show.arrows.length * 0.4, "pop");
      break;
  }
  const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
  s.note = a(end + 0.2, "fade");
  return s;
}
