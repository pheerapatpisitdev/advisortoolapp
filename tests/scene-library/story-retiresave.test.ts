import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { quotePension } from "@/calc/pension/engine";
import { checkDevice } from "@/lib/prompt-story/check";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { checkedStory, storyCaption, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { clipFrame } from "@/lib/quote-video/story-frames";
import { isDevice, KNOW_KEYS, knowEpisode, knowText, type KnowShow, type SaveShow } from "@/lib/quote-video/story-knowledge";
import { MONEY_CLOSE, moneyScenes } from "@/lib/quote-video/story-money";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { DEFAULT_CAST } from "@/lib/story/figure";
import { figureShown, INFO_SHELVES, STORY_TOPICS, topicOf } from "@/lib/story/topics";

/**
 * device round 4, Task 5 (spec 2026-11-15-devices-saving-design.md, "คลิปเล่าเรื่อง: เก็บเงินไว้ใช้ตอนเกษียณ"): topic
 * retiresave on the money shelf, five scenes, its figures the บำนาญ สมาร์ท 95 engine's and nothing typed.
 */
const PENSION = { sex: "M", age: 40, annuityAge: 60, pay: "untilAnnuity", monthly: 10_000 };
const BASE = { topic: "retiresave", faces: { narrator: "w26", hero: "w15" }, pension: PENSION };

const input = (over: Record<string, unknown> = {}): StoryVideoInput => {
  const s = checkedStory({ ...BASE, ...over } as never, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};
const scenes = (inp = input()) => moneyScenes("retiresave", inp);

/** the engine's own numbers for the spec's example, worked out here from its illustration, not typed */
function engine() {
  const sum = input().pension!.sumAssured;
  const r = quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "sumAssured", amount: sum });
  if (!r.ok) throw new Error(r.error);
  const paying = r.quote.illustration.filter((y) => y.premium > 0);
  return {
    years: paying.length, payFrom: paying[0].age, payTo: paying[paying.length - 1].age,
    paid: Math.floor(paying.reduce((s, y) => s + y.premium, 0)), got: r.quote.totalPension,
    getFrom: r.quote.plan.annuityStartAge, getTo: r.quote.illustration[r.quote.illustration.length - 1].age,
  };
}

describe("retiresave: the topic", () => {
  it("is on the money shelf, takes the pension figure, and needs it", () => {
    const t = topicOf("retiresave")!;
    expect(t).toMatchObject({ key: "retiresave", name: "เก็บเงินไว้ใช้ตอนเกษียณ", shelf: "money", figure: "pension", blurb: "เงินเท่าเดิมซื้อได้น้อยลง ส่งทีละปี ได้คืนเป็นบำนาญ" });
    expect(INFO_SHELVES).toContain("money");
    // the pension is on the form without the switch, as the plan is for ส่งมอบกรมธรรม์
    expect(figureShown(t, false)).toBe(true);
    expect(figureShown(topicOf("preretire")!, false)).toBe(false);
    expect(STORY_TOPICS.filter((x) => x.shelf === "money").map((x) => x.key)).toEqual(["lifeneed", "ciincome", "taxback", "retiresave"]);
  });

  it("says ใส่บำนาญที่ลูกค้าต้องการ without a pension, and the engine's own words for one it will not price", () => {
    expect(checkedStory({ topic: "retiresave", faces: BASE.faces } as never, "F")).toBe("ใส่บำนาญที่ลูกค้าต้องการ");
    expect(checkedStory({ ...BASE, pension: undefined } as never, "F")).toBe("ใส่บำนาญที่ลูกค้าต้องการ");
    expect(checkedStory({ ...BASE, pension: { ...PENSION, age: 70 } } as never, "F")).toMatch(/อายุ/);
    expect(checkedStory({ ...BASE, pension: { ...PENSION, monthly: 0 } } as never, "F")).toMatch(/บำนาญต่อเดือน/);
    // other topics keep the pension optional
    expect(typeof checkedStory({ topic: "preretire", faces: BASE.faces } as never, "F")).toBe("object");
    expect(typeof checkedStory({ topic: "lifeneed", faces: BASE.faces } as never, "F")).toBe("object");
  });

  it("keeps the pension and takes no typed money", () => {
    const s = input({ money: { debts: 1_000_000 } });
    expect(s.pension).toMatchObject({ sex: "M", age: 40, annuityAge: 60, pay: "untilAnnuity" });
    expect(s.money).toBeUndefined();
  });
});

describe("retiresave: five scenes, as the spec has them", () => {
  it("lists the layouts, the titles and the voices of the spec, in the female voice", () => {
    const s = scenes();
    expect(s.map((x) => x.key)).toEqual(KNOW_KEYS);
    expect(s.map((x) => x.show.layout)).toEqual(["ask", "pricerise", "savejar", "paidgot", "recap"]);
    expect(s[0].show).toEqual({ layout: "ask", title: ["เกษียณแล้ว", "เงินเก็บพอไหม?"] });
    expect(s[0].voice).toBe("เกษียณแล้ว เงินเดือนหยุด แต่ค่าใช้จ่ายยังเดินต่อทุกเดือน เงินที่เก็บไว้จะพอใช้ไปอีกกี่ปีคะ");
    expect(s[1].show).toEqual({ layout: "pricerise", title: ["เงินเท่าเดิม", "ซื้อได้น้อยลง"] });
    expect(s[1].voice).toBe("ของที่วันนี้ซื้อได้เต็มตะกร้า อีกหลายปีข้างหน้า เงินก้อนเดิม ซื้อได้น้อยลง เพราะราคาของขยับขึ้นทุกปีค่ะ");
    expect(s[2].show).toMatchObject({ layout: "savejar", title: ["ส่งทีละปี", "ก้อนโตขึ้นเรื่อยๆ"] });
    expect(s[2].voice).toBe("ทางหนึ่งคือแบ่งเงินส่งเข้าแผนบำนาญทุกปี ตั้งแต่วันนี้ จนถึงวันเกษียณค่ะ");
    expect(s[3].show).toMatchObject({ layout: "paidgot", title: ["ส่งเท่าไร", "ได้คืนเท่าไร"] });
    expect(s[3].voice).toBe("พอถึงวันเกษียณ แผนจ่ายบำนาญกลับมาทุกปี ไปจนอายุเก้าสิบห้า ทุกตัวเลขอยู่ในตารางผลประโยชน์ของแผนค่ะ");
    expect(s[4].show).toEqual({
      layout: "recap",
      lines: [{ text: "ราคาของขึ้นทุกปี", big: true }, { text: "เตรียมบำนาญไว้ก่อน", big: true, tone: "green" }, { text: "ตรวจสอบเงื่อนไขก่อนตัดสินใจ" }],
    });
    expect(s[4].voice).toMatch(/ค่ะ|คะ/);
  });

  it("does not use pensionsteps, which is for the library and คลิปตามโจทย์ only", () => {
    expect(scenes().some((x) => x.show.layout === "pensionsteps")).toBe(false);
  });

  it("runs through knowEpisode and storyScript with its close", () => {
    const e = knowEpisode(input());
    expect(e.scenes).toHaveLength(5);
    expect(e.cta).toBe(MONEY_CLOSE.retiresave);
    expect(MONEY_CLOSE.retiresave).toMatch(/ทักมา/);
    expect(knowText(e).length).toBeGreaterThan(0);
    expect(storyScript(input()).map((x) => x.key)).toEqual([...KNOW_KEYS, "storyContact"]);
  });
});

describe("retiresave: the figures are the engine's", () => {
  it("pins the spec's example: ชาย 40, from 60, paid to 60, 10,000 a month", () => {
    const e = engine();
    expect(e).toMatchObject({ years: 20, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95, got: 6_023_625 });
    // the engine's twenty premiums of 136,220.54, floored to the baht (the page's เบี้ยสะสม floors: pensionFigure)
    expect(e.paid).toBe(2_724_410);
  });

  it("draws savejar and paidgot from them", () => {
    const e = engine();
    const s = scenes();
    expect(s[2].show).toMatchObject({ layout: "savejar", years: e.years, paid: e.paid });
    expect(s[3].show).toMatchObject({ layout: "paidgot", paid: e.paid, got: e.got, payFrom: e.payFrom, payTo: e.payTo, getFrom: e.getFrom, getTo: e.getTo });
  });

  it("follows the pension the agent asked for (paid in six years)", () => {
    const six = input({ pension: { ...PENSION, pay: "6" } });
    const r = quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "6", mode: "annual", basis: "sumAssured", amount: six.pension!.sumAssured });
    if (!r.ok) throw new Error(r.error);
    const s = scenes(six);
    expect(s[2].show).toMatchObject({ years: 6 });
    expect(s[3].show).toMatchObject({ payFrom: 40, payTo: 45, got: r.quote.totalPension });
  });

  it("every figure on screen passes checkDevice with the engine's numbers as its only source", () => {
    const e = engine();
    const only = new Set([e.years, e.paid, e.got, e.payFrom, e.payTo, e.getFrom, e.getTo]);
    for (const x of scenes().filter((y) => isDevice(y.show))) expect(checkDevice(x.show, only), x.show.layout).toEqual(x.show);
  });

  it("says no figure aloud: the voice carries no digit and the screen's figures are the engine's", () => {
    const e = engine();
    const allowed = new Set([e.years, e.paid, e.got, e.payFrom, e.payTo, e.getFrom, e.getTo]);
    for (const x of scenes()) {
      expect(x.voice, x.show.layout).not.toMatch(/\d/);
      const own = Object.entries(x.show).filter(([, v]) => typeof v === "number") as [string, number][];
      for (const [k, v] of own) expect(allowed.has(v), `${x.show.layout} ${k}`).toBe(true);
    }
  });

  it("pricerise draws no figure", () => {
    const show = scenes()[1].show as SaveShow<"pricerise">;
    expect(Object.entries(show).filter(([, v]) => typeof v === "number")).toEqual([]);
  });

  it("without a pension (never through the form) it still draws, in words", () => {
    const bare = { ...input(), pension: undefined } as StoryVideoInput;
    const s = scenes(bare);
    expect(s).toHaveLength(5);
    expect(s[2].show).toMatchObject({ layout: "savejar" });
    expect(s[3].show.layout).not.toBe("paidgot");
  });
});

describe("retiresave: no return word, no percent", () => {
  const all = (inp = input()) => {
    const text = (show: KnowShow) => JSON.stringify(show);
    return [...scenes(inp).flatMap((s) => [text(s.show), s.voice]), knowText(knowEpisode(inp)), storyCaption(inp), ...storyScript(inp).map((s) => s.voice)].join("\n");
  };

  it("keeps clear of every word the script forbids, and of IRR", () => {
    const text = all();
    for (const f of FORBIDDEN) expect(f.re.test(text), f.why).toBe(false);
    expect(text).not.toMatch(/irr|%|ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล|เบี้ย/i);
  });

  it("has the spec's caption line, and its own two lines on top", () => {
    const c = storyCaption(input());
    expect(c).toContain("ตัวเลขจากตารางผลประโยชน์ บำนาญ สมาร์ท 95 ตรวจสอบเงื่อนไขก่อนตัดสินใจ");
    expect(c).not.toContain("ตัวแทนกรอก");
    expect(c.split("\n")[0]).toBe("เก็บเงินไว้ใช้ตอนเกษียณ");
    expect(c).toContain("#วางแผนการเงิน");
  });
});

describe("retiresave: every look the money shelf offers draws every scene", () => {
  const contact = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
  const LOOKS: { art?: string; extra?: Record<string, unknown> }[] = [
    {}, { art: "paper" }, { art: "line" }, { art: "info" }, { art: "plot" }, { art: "board" }, { art: "neon" }, { art: "blueprint" },
    { art: "minimal", extra: { cast: { hero: DEFAULT_CAST.hero.F, narrator: DEFAULT_CAST.narrator } } },
  ];
  it("offers the info looks on its shelf", () => {
    for (const art of ["info", "plot", "board", "neon", "blueprint"]) expect(input({ art })).toMatchObject({ art });
  });
  for (const look of LOOKS) {
    it(`${look.art ?? "the default look"}: every scene, in every shape`, () => {
      for (const size of ["portrait", "square", "landscape"] as const) {
        const clip = input({ ...(look.art ? { art: look.art } : {}), ...look.extra, size });
        for (const s of storyScript(clip)) {
          const c: StoryContext = { input: clip, size, customer: "", narrator: "F", contact, crowd: [], faces: {}, words: s.voice.split(" "), voiceSec: 5 };
          for (const t of [0.3, 1.5, 7]) expect(renderToStaticMarkup(clipFrame(s.key, c, t)).length, `${look.art} ${size} ${s.key}`).toBeGreaterThan(400);
        }
      }
    });
  }
});
