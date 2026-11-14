import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { infoDrawn } from "@/lib/quote-video/story-info-motion";
import { META_LAYOUTS, type Kin, type KnowShow, type MetaShow } from "@/lib/quote-video/story-knowledge";
import { kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { FALL_LINE, MAIN_X, metaFigures, netShape } from "@/lib/quote-video/story-meta-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import type { VideoSize } from "@/lib/quote-video/timeline";

/**
 * device round 3, final review fixes: the people come in with their scene (never before its set beat, left to right),
 * the safety net's fall line goes once they land, and the pillar's opener can draw the household's own people.
 */

const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const STORY_LOOKS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];
const INFO_LOOKS: Partial<StoryVideoInput>[] = [{ art: "plot" }, { art: "board" }, { art: "neon" }, { art: "blueprint" }];
const LOOKS = [...STORY_LOOKS, ...INFO_LOOKS];
const isInfo = (art: Partial<StoryVideoInput>) => INFO_LOOKS.includes(art);

const ctx = (size: VideoSize, art: Partial<StoryVideoInput>): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

/** one of each, as the story openers carry them */
const MAIN: MetaShow[] = [
  { layout: "umbrella", title: ["“ซื้อประกัน", "เหมือนแช่งตัวเอง”"], note: "พกร่ม ไม่ได้ทำให้ฝนตก" },
  { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""], note: "รายได้หลักของบ้าน", label: "รายได้" },
  { layout: "housepillar", title: ["เสาหลัก", "ของบ้าน"], note: "ประกันคือเสาสำรอง", spare: "ประกันชีวิต" },
  { layout: "lifering", title: ["ป่วยหนัก", "รายได้หายไปไหน?"], note: "เงินก้อนมาตอนที่ต้องการที่สุด" },
  { layout: "safetynet", title: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"], note: "ตาข่ายนี้ เราขึงเองได้" },
  { layout: "seedtree", title: ["“เบี้ยแพง", "ไม่มีงบ”"], note: "เริ่มเล็ก ดีกว่าไม่เริ่ม" },
  { layout: "balance", title: ["“ฝากธนาคาร", "ดีกว่า”"], note: "ออมไว้ใช้ ประกันกันเรื่องใหญ่", sides: ["เงินออม", "ประกัน"], tilt: "even" },
  { layout: "bridge", title: ["“มีบัตรทอง", "ประกันสังคมแล้ว”"], note: "ช่วงป่วย รายได้หาย ต้องมีสะพาน" },
  { layout: "shield", title: ["ประกันชีวิต", "คืออะไรกันแน่?"], note: "ประกันรับแทนเรา", arrows: ["จากไปเร็ว", "อยู่นานเกิน", "ป่วยหนัก", "อุบัติเหตุ", "ทุพพลภาพ"] },
];
/** the pillar episode's household: the partner, the hero, two children (story-family.ts's kin row) */
const KIN: Kin[] = [{ id: "m09", size: "adult" }, { id: "w15", size: "hero" }, { id: "c12", size: "kid" }, { id: "c27", size: "kid" }];
const PILLAR_PEOPLE: MetaShow<"housepillar"> = { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""], note: "รายได้หลักของบ้าน", label: "รายได้", people: KIN };

const draw = (show: KnowShow, size: VideoSize, art: Partial<StoryVideoInput>, t: number) =>
  renderToStaticMarkup(<>{isInfo(art) ? infoDrawn(show, ctx(size, art), t) : showBody(show, ctx(size, art), t)}</>);

/**
 * each drawn person (an element carrying data-who) and whether it is hidden: nothing it draws (an svg or img inside it)
 * shows, each standing in something with opacity 0. A small walk over the markup's tags (no parser in the tests' node).
 */
function people(markup: string): { who: number; face?: string; hidden: boolean }[] {
  const out: { who: number; face?: string; hidden: boolean }[] = [];
  /** per open element: whether it is hidden, and the person it opened (if it did) */
  const stack: { hidden: boolean; person?: number }[] = [];
  const open: number[] = [];
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g;
  for (let m = tag.exec(markup); m; m = tag.exec(markup)) {
    const [, close, name, attrs, self] = m;
    if (close) {
      const top = stack.pop();
      if (top?.person !== undefined) open.pop();
      continue;
    }
    const style = /style="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const hidden = (stack.length ? stack[stack.length - 1].hidden : false) || /(^|;)opacity:0(?![.\d])/.test(style);
    const who = /data-who="(\d+)"/.exec(attrs);
    let person: number | undefined;
    if (who) {
      person = out.length;
      out.push({ who: Number(who[1]), face: /data-face="([^"]+)"/.exec(attrs)?.[1], hidden: true });
      open.push(person);
    }
    // a drawing inside a person that shows: the person shows
    if ((name === "svg" || name === "img") && !hidden) for (const i of open) out[i].hidden = false;
    if (!self) stack.push({ hidden, person });
    else if (person !== undefined) open.pop();
  }
  return out;
}

describe("the people come in with their scene", () => {
  it("at scene t=0 and just before the set beat, no one is visible, in every layout, look and size", () => {
    for (const show of MAIN) for (const art of LOOKS) for (const size of SIZES) {
      const set = kspec(show).set;
      for (const t of [-0.5, 0, 0.3, set.at - 0.01]) {
        const ps = people(draw(show, size, art, t));
        const label = `${show.layout} ${art.art} ${size} t=${t}`;
        expect(ps.filter((p) => !p.hidden), label).toEqual([]);
      }
    }
  });

  it("they are drawn: each layout with people shows them all at its end", () => {
    for (const show of MAIN) for (const art of LOOKS) {
      const s = kspec(show);
      const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
      const ps = people(draw(show, "portrait", art, end));
      expect(ps.length, `${show.layout} ${art.art}`).toBe(metaFigures(show, ctx("portrait", art), end).length);
      expect(ps.every((p) => !p.hidden), `${show.layout} ${art.art}`).toBe(true);
    }
  });

  it("they come in left to right: one further right is never visible before one further left", () => {
    for (const show of [...MAIN, PILLAR_PEOPLE]) for (const art of LOOKS) {
      const set = kspec(show).set;
      const first = new Map<number, number>();
      for (let t = set.at - 0.1; t <= set.at + 2; t += 0.02) {
        for (const p of people(draw(show, "portrait", art, t))) if (!p.hidden && !first.has(p.who)) first.set(p.who, t);
      }
      const xs = metaFigures(show, ctx("portrait", art), set.at + 2).map((f) => f.x);
      const order = [...xs.keys()].sort((a, b) => xs[a] - xs[b]);
      const label = `${show.layout} ${art.art}`;
      expect(first.size, label).toBe(xs.length);
      for (let i = 1; i < order.length; i += 1) expect(first.get(order[i])!, `${label}: ${order[i]} after ${order[i - 1]}`).toBeGreaterThanOrEqual(first.get(order[i - 1])!);
      for (const t of first.values()) expect(t, `${label}: none before the set beat`).toBeGreaterThanOrEqual(set.at);
    }
  });
});

describe("the safety net's fall line", () => {
  const show = MAIN.find((x) => x.layout === "safetynet")!;
  const s = kspec(show);
  const landed = s.fall.at + s.fall.dur * 0.32;
  const has = (markup: string) => markup.includes(FALL_LINE);

  it("shows from the slip, while they fall, and is gone shortly after they land (every look)", () => {
    for (const art of LOOKS) {
      expect(has(draw(show, "portrait", art, s.trouble.at + 0.3)), `${art.art} slipping`).toBe(true);
      expect(has(draw(show, "portrait", art, landed + 0.6)), `${art.art} after landing`).toBe(false);
      const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
      expect(has(draw(show, "portrait", art, end)), `${art.art} the final hold`).toBe(false);
    }
  });

  it("fades rather than vanishing: its opacity falls from the landing to nothing", () => {
    const a = netShape(s, landed - 0.05).fallLine;
    const b = netShape(s, landed + 0.12).fallLine;
    const c = netShape(s, landed + 0.5).fallLine;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(a);
    expect(c).toBe(0);
  });
});

describe("the pillar's household", () => {
  it("draws the people the show carries, in their order and faces, in the story looks", () => {
    for (const art of STORY_LOOKS) for (const size of SIZES) {
      const s = kspec(PILLAR_PEOPLE);
      const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
      const ps = people(draw(PILLAR_PEOPLE, size, art, end));
      expect(ps.map((p) => p.face), `${art.art} ${size}`).toEqual(KIN.map((k) => k.id));
    }
  });

  it("without people the generic family of three, as before", () => {
    const show = MAIN[1];
    for (const art of STORY_LOOKS) expect(metaFigures(show, ctx("portrait", art), 5)).toHaveLength(3);
  });

  it("every one stands under the roof on the floor, clear of the pillar, the children smaller, in order left to right", () => {
    for (const art of LOOKS) for (const spare of [undefined, "ประกัน"]) {
      const show: MetaShow<"housepillar"> = { ...PILLAR_PEOPLE, ...(spare ? { spare } : {}) };
      const figs = metaFigures(show, ctx("portrait", art), 5);
      const label = `${art.art} spare=${!!spare}`;
      expect(figs, label).toHaveLength(KIN.length);
      for (let i = 1; i < figs.length; i += 1) expect(figs[i].x, label).toBeGreaterThan(figs[i - 1].x);
      for (const f of figs) {
        expect(f.foot - f.h, label).toBeGreaterThan(150);
        expect(f.x - f.w / 2, label).toBeGreaterThanOrEqual(20);
        expect(f.x + f.w / 2, label).toBeLessThanOrEqual(380);
        expect(Math.abs(f.x - MAIN_X), `${label}: off the pillar`).toBeGreaterThan(30);
      }
      expect(figs[2].w, label).toBeLessThan(figs[0].w);
      expect(figs[3].w, label).toBeLessThan(figs[1].w);
    }
  });

  it("every layout still draws in every look with people on the pillar", () => {
    expect(META_LAYOUTS).toContain("housepillar");
    for (const art of LOOKS) for (const size of SIZES) for (const t of [0, 0.8, 1.6, 3, 6]) {
      const out = draw(PILLAR_PEOPLE, size, art, t);
      expect(out, `${art.art} ${size} ${t}`).not.toContain("NaN");
    }
  });
});
