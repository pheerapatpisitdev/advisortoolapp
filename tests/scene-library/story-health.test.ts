import { describe, expect, it } from "vitest";
import { checkedStory, storyHealth, type StoryVideoInput } from "@/lib/quote-video/story";
import { KNOW_KEYS, knowEpisode, knowText, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { healthScenes, HEALTH_CLOSE, type HealthTopic } from "@/lib/quote-video/story-health";
import { objectionScenes } from "@/lib/quote-video/story-objection";
import { INFO_SHELVES, STORY_TOPICS, type StoryTopic } from "@/lib/story/topics";

const TOPICS: HealthTopic[] = ["lumpsum", "roomcost", "waiting", "agecost"];
const ORDER: Record<HealthTopic, string[]> = {
  lumpsum: ["ask", "split", "room", "limit", "recap"],
  roomcost: ["ask", "room", "overflow", "list", "recap"],
  waiting: ["ask", "waiting", "note", "cashless", "recap"],
  agecost: ["ask", "agecost", "note", "list", "recap"],
};
const PLAN = { plan: "SILVER", sex: "M", age: 35 };

const input = (topic: StoryTopic, health?: Record<string, unknown>): StoryVideoInput => {
  const s = checkedStory({ topic, faces: { narrator: "w26", hero: "w15" }, ...(health ? { health } : {}) }, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};
const withHealth = (topic: HealthTopic, extra: Record<string, unknown> = {}) => input(topic, { ...PLAN, ...extra });

/** every digit run in what a show puts on screen */
const numbersOf = (show: KnowShow): number[] => {
  const out: number[] = [];
  const walk = (v: unknown, key = "") => {
    if (typeof v === "number") out.push(v);
    else if (typeof v === "string") for (const m of v.match(/\d[\d,]*/g) ?? []) out.push(Number(m.replace(/,/g, "")));
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(show);
  return out;
};

describe("storyHealth", () => {
  it("carries the plan's figures with the typed numbers", () => {
    const h = storyHealth({ ...PLAN, room: 6000, bill: 300_000, group: 50_000 });
    if (typeof h === "string") throw new Error(h);
    expect(h).toMatchObject({ plan: "SILVER", sex: "M", age: 35, room: 6000, bill: 300_000, group: 50_000 });
    expect(h.figures.roomPerDay).toBe(5500);
  });
  it("says in Thai what is wrong", () => {
    expect(storyHealth({ ...PLAN, room: -1 })).toMatch(/[ก-๙]/);
    expect(storyHealth({ ...PLAN, bill: 10_000_001 })).toMatch(/[ก-๙]/);
    expect(storyHealth({ ...PLAN, group: 1.5 })).toMatch(/[ก-๙]/);
    expect(storyHealth({ ...PLAN, sex: "X" })).toMatch(/[ก-๙]/);
    expect(storyHealth({ ...PLAN, plan: "NOPE" })).toMatch(/[ก-๙]/);
  });
  it("treats an empty typed number as absent", () => {
    const h = storyHealth({ ...PLAN, room: "", bill: null });
    if (typeof h === "string") throw new Error(h);
    expect(h.room).toBeUndefined();
    expect(h.bill).toBeUndefined();
  });
});

describe("the ประกันสุขภาพ shelf", () => {
  it("lists four topics that take an iHealthy figure and offers the plot look", () => {
    const health = STORY_TOPICS.filter((t) => t.shelf === "health");
    expect(health.map((t) => t.key)).toEqual(TOPICS);
    for (const t of health) expect(t.figure).toBe("health");
    expect(INFO_SHELVES).toContain("health");
    expect(checkedStory({ topic: "lumpsum", art: "plot", health: PLAN } as never, "F")).toMatchObject({ art: "plot" });
  });

  it("refuses a health topic without its plan", () => {
    expect(typeof checkedStory({ topic: "lumpsum" }, "F")).toBe("string");
  });

  for (const topic of TOPICS) {
    it(`${topic}: five scenes, in the spec's order`, () => {
      const scenes = healthScenes(topic, withHealth(topic), "");
      expect(scenes.map((s) => s.key)).toEqual(KNOW_KEYS);
      expect(scenes.map((s) => s.show.layout)).toEqual(ORDER[topic]);
      for (const s of scenes) expect(s.voice.length).toBeGreaterThan(0);
      expect(HEALTH_CLOSE[topic]).toMatch(/ทักมา/);
    });

    it(`${topic}: every number comes from the figures or the typed inputs`, () => {
      const typed = { room: 6000, bill: 300_000, group: 50_000 };
      const inp = withHealth(topic, typed);
      const f = inp.health!.figures;
      const allowed = new Set<number>([
        f.annualMax, f.roomPerDay, f.waitingDays, f.specialWaitingDays, f.copayPercent,
        ...f.ages.flatMap((a) => [a.age, a.annual]),
        typed.room, typed.bill, typed.group,
        typed.bill - f.annualMax, typed.room - f.roomPerDay, typed.bill - typed.group,
      ]);
      for (const s of healthScenes(topic, inp, "")) {
        for (const num of numbersOf(s.show)) expect(allowed.has(num), `${topic} ${s.show.layout} ${num}`).toBe(true);
      }
    });

    it(`${topic}: runs through knowEpisode with the card's close`, () => {
      const e = knowEpisode(withHealth(topic));
      expect(e.scenes).toHaveLength(5);
      expect(e.cta).toBe(HEALTH_CLOSE[topic]);
      expect(knowText(e).length).toBeGreaterThan(0);
    });
  }

  it("roomcost puts the room the customer uses beside the plan's", () => {
    const room = healthScenes("roomcost", withHealth("roomcost", { room: 6000 }), "").find((s) => s.show.layout === "room")!;
    expect(room.show).toMatchObject({ layout: "room", real: 6000, plan: 5500 });
    const bare = healthScenes("roomcost", withHealth("roomcost"), "").find((s) => s.show.layout === "room")!;
    expect(bare.show).toMatchObject({ layout: "room", plan: 5500 });
    expect((bare.show as { real?: number }).real).toBeUndefined();
  });

  it("agecost draws the rider's ages; with fewer than two the second scene is a note", () => {
    const inp = withHealth("agecost");
    const second = healthScenes("agecost", inp, "")[1].show;
    expect(second).toMatchObject({ layout: "agecost", rows: inp.health!.figures.ages });
    expect((second as { source: string }).source).toMatch(/สัญญาเพิ่มเติมสุขภาพ.*ไม่รวมสัญญาหลัก.*Silver.*ชาย/);
    const one = { ...inp, health: { ...inp.health!, figures: { ...inp.health!.figures, ages: inp.health!.figures.ages.slice(0, 1) } } };
    expect(healthScenes("agecost", one, "")[1].show.layout).toBe("note");
  });

  it("waiting reads the days off the sheet", () => {
    const inp = withHealth("waiting");
    const f = inp.health!.figures;
    expect(healthScenes("waiting", inp, "")[1].show).toMatchObject({
      layout: "waiting",
      rows: [{ at: "วันนี้", label: "อุบัติเหตุ" }, { at: `${f.waitingDays} วัน`, label: "ป่วยทั่วไป" }, { at: `${f.specialWaitingDays} วัน`, label: "บางโรค" }],
    });
  });
});

describe("มีประกันกลุ่มบริษัทแล้ว with a typed bill", () => {
  it("shows groupgap in the fourth scene's place only when bill and group are both typed", () => {
    // an episode has exactly five scenes (KNOW_KEYS), so the gap replaces the note about applying on one's own
    const both = objectionScenes("groupins", input("groupins", { ...PLAN, bill: 325_000, group: 50_000 }));
    expect(both.map((s) => s.key)).toEqual(KNOW_KEYS);
    expect(both[3].show).toMatchObject({ layout: "groupgap", bill: 325_000, group: 50_000 });
    expect(both[0].show.layout).toBe("myth");
    expect(objectionScenes("groupins", input("groupins", { ...PLAN, bill: 325_000 })).some((s) => s.show.layout === "groupgap")).toBe(false);
  });
});
