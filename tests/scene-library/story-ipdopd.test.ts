import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkDevice } from "@/lib/prompt-story/check";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { checkedStory, storyCaption, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { clipFrame } from "@/lib/quote-video/story-frames";
import { isDevice, KNOW_KEYS, knowEpisode, knowText, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { healthScenes, HEALTH_CLOSE } from "@/lib/quote-video/story-health";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { healthFigures } from "@/lib/scene-library/health-figures";
import { hospitalCounts, opdOf, roomOf } from "@/lib/scene-library/health2-sources";
import { iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";
import { DEFAULT_CAST } from "@/lib/story/figure";
import { INFO_SHELVES, STORY_TOPICS, topicOf } from "@/lib/story/topics";

/**
 * device round 5, Task 5 (spec 2026-11-15-devices-health2-design.md, "คลิปเล่าเรื่อง: ผู้ป่วยใน ผู้ป่วยนอก ต่างกันยังไง"):
 * topic ipdopd on the health shelf, five scenes, its figures the iHealthy sheet's, the agent's age and the hospital list's.
 */
const faces = { narrator: "w26", hero: "w15" };
const input = (plan: string, over: Record<string, unknown> = {}): StoryVideoInput => {
  const { health, ...rest } = over;
  const s = checkedStory({ topic: "ipdopd", faces, health: { plan, sex: "F", age: 35, ...(health as object) }, ...rest } as never, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};
const scenes = (plan = "GOLD", over: Record<string, unknown> = {}) => healthScenes("ipdopd", input(plan, over), "");
const sheetRow = (no: number) => {
  const row = iHealthyFacts().rows.find((r) => !isHeading(r) && r.no === no);
  if (!row || isHeading(row)) throw new Error(`no row ${no}`);
  return row;
};

describe("ipdopd: the topic", () => {
  it("is on the health shelf, takes the iHealthy figure, and opens as the health topics do", () => {
    const t = topicOf("ipdopd")!;
    expect(t).toMatchObject({ key: "ipdopd", name: "ผู้ป่วยใน ผู้ป่วยนอก ต่างกันยังไง", shelf: "health", figure: "health" });
    expect(t.blurb).toMatch(/[ก-๙]/);
    expect(STORY_TOPICS.filter((x) => x.shelf === "health").map((x) => x.key)).toEqual(["lumpsum", "roomcost", "waiting", "agecost", "ipdopd"]);
    expect(INFO_SHELVES).toContain("health");
  });

  it("refuses the topic without its plan", () => {
    expect(typeof checkedStory({ topic: "ipdopd", faces } as never, "F")).toBe("string");
  });
});

describe("ipdopd: five scenes, as the spec has them", () => {
  it("lists the layouts and keys, the titles, and the recap and close of the spec", () => {
    const s = scenes();
    expect(s.map((x) => x.key)).toEqual(KNOW_KEYS);
    expect(s.map((x) => x.show.layout)).toEqual(["ask", "ipdopd", "renew98", "hospitals", "recap"]);
    expect(s[0].show).toEqual({ layout: "ask", title: ["ผู้ป่วยใน", "ผู้ป่วยนอก ต่างกันยังไง?"] });
    expect(s[1].show).toMatchObject({ layout: "ipdopd", title: ["สองประตู", "คนละวงเงิน"] });
    expect(s[2].show).toMatchObject({ layout: "renew98", title: ["ต่ออายุได้ถึง", "อายุเก้าสิบแปด"] });
    expect(s[3].show).toMatchObject({ layout: "hospitals", title: ["โรงพยาบาลในเครือ", "ทั่วประเทศ"] });
    expect(s[4].show).toEqual({
      layout: "recap",
      lines: [{ text: "ผู้ป่วยใน ผู้ป่วยนอก", big: true }, { text: "คนละวงเงิน", big: true, tone: "green" }, { text: "เลือกแผนให้ตรง กับที่ใช้จริง" }],
    });
    expect(HEALTH_CLOSE.ipdopd).toBe("อยากรู้ว่าแผนไหนมีผู้ป่วยนอก ทักมาได้เลย");
  });

  it("says the spec's voices (the female voice), the OPD one in its three variants", () => {
    const gold = scenes("GOLD");
    expect(gold[0].voice).toBe("ไปหาหมอแล้วกลับบ้าน กับต้องนอนโรงพยาบาล ประกันสุขภาพดูแลต่างกันนะคะ");
    expect(gold[1].voice).toBe("แผน iHealthy Gold นอนโรงพยาบาล ค่าห้อง 9,000 บาทต่อวัน ส่วนไปหาหมอแล้วกลับบ้าน มีวงเงินรวม 12,000 บาทต่อปีค่ะ");
    expect(gold[2].voice).toBe("แผนนี้ต่ออายุได้ถึงอายุเก้าสิบแปด ไม่เกินระยะเวลาของสัญญาหลัก และเบี้ยปรับตามช่วงอายุค่ะ");
    expect(gold[3].voice).toBe("มีโรงพยาบาลในเครือทั่วประเทศ ดูรายชื่อเต็มได้ที่เว็บบริษัทค่ะ");
    expect(gold[4].voice).toBe("จำง่าย ๆ ค่ะ นอนโรงพยาบาลกับไปหาหมอแล้วกลับบ้าน มีวงเงินคนละส่วน เลือกแผนให้ตรงกับที่เราใช้จริง");
    expect(scenes("SMART")[1].voice).toBe("แผน iHealthy Smart นอนโรงพยาบาล ค่าห้อง 1,500 บาทต่อวัน ส่วนไปหาหมอแล้วกลับบ้านแบบทั่วไป แผนนี้ไม่ได้รวมไว้ค่ะ");
    expect(scenes("PLATINUM")[1].voice).toBe("แผน iHealthy Platinum นอนโรงพยาบาล ค่าห้อง 21,000 บาทต่อวัน ส่วนไปหาหมอแล้วกลับบ้าน จ่ายตามที่จ่ายจริง ตามเงื่อนไขของแผนค่ะ");
  });

  it("runs through knowEpisode and storyScript with its close", () => {
    const e = knowEpisode(input("GOLD"));
    expect(e.scenes).toHaveLength(5);
    expect(e.cta).toBe(HEALTH_CLOSE.ipdopd);
    expect(knowText(e).length).toBeGreaterThan(0);
    expect(storyScript(input("GOLD")).map((x) => x.key)).toEqual([...KNOW_KEYS, "storyContact"]);
  });
});

describe("ipdopd: the figures are the sheet's", () => {
  it("GOLD: room 9,000 and OPD 12,000, the sheet's rows 1, 18 and 19", () => {
    expect(sheetRow(18).adult.GOLD).toBe(sheetRow(19).adult.GOLD);
    const s = scenes("GOLD");
    expect(s[1].show).toMatchObject({ layout: "ipdopd", room: roomOf("GOLD"), opd: opdOf("GOLD"), planName: "Gold" });
    expect(s[1].show).toMatchObject({ room: 9000, opd: 12000 });
  });

  it("SMART's OPD is none, PLATINUM's is as paid: the sheet's two words, never a number", () => {
    expect(opdOf("SMART")).toBe("none");
    expect(opdOf("PLATINUM")).toBe("actual");
    expect(scenes("SMART")[1].show).toMatchObject({ room: 1500, opd: "none" });
    expect(scenes("PLATINUM")[1].show).toMatchObject({ room: 21000, opd: "actual" });
  });

  it("every plan: the figures equal the sheet and the room equals the plan's room per day", () => {
    for (const p of iHealthyFacts().plans) {
      const f = healthFigures({ plan: p.code, sex: "F", age: 35 });
      if (typeof f === "string") continue;
      expect(f.opd, p.code).toEqual(opdOf(p.code));
      expect(f.renewalToAge).toBe(iHealthyFacts().terms.renewalToAge);
      expect(f.roomPerDay).toBe(roomOf(p.code));
      expect(scenes(p.code)[1].show).toMatchObject({ room: roomOf(p.code), opd: opdOf(p.code) });
    }
  });

  it("renew98 draws the sheet's age, and today's age from the form's input", () => {
    expect(scenes("GOLD")[2].show).toMatchObject({ layout: "renew98", to: 98, age: 35 });
    expect(scenes("GOLD", { health: { age: 52 } })[2].show).toMatchObject({ to: 98, age: 52 });
  });

  it("renew98 leaves out an age that is no time before the end (today's age 0)", () => {
    const s = healthScenes("ipdopd", { ...input("GOLD"), health: { ...input("GOLD").health!, age: 0 } }, "");
    expect(s[2].show).toMatchObject({ layout: "renew98", to: 98 });
    expect(s[2].show).not.toHaveProperty("age");
  });

  it("hospitals: the five provinces with the most hospitals, counts and total as the JSON's", () => {
    const h = hospitalCounts();
    const show = scenes()[3].show as Extract<KnowShow, { layout: "hospitals" }>;
    expect(show.total).toBe(h.total);
    expect(show.total).toBe(537);
    expect(show.rows).toEqual(h.ranked.slice(0, 5));
    expect(show.rows.map((r) => r.count)).toEqual([...show.rows.map((r) => r.count)].sort((a, b) => b - a));
    for (const r of show.rows) expect(h.counts[r.province]).toBe(r.count);
  });

  it("every device passes checkDevice with the sheet's, the age's and the list's numbers as its only source", () => {
    const f = healthFigures({ plan: "GOLD", sex: "F", age: 35 });
    if (typeof f === "string") throw new Error(f);
    const h = hospitalCounts();
    const only = new Set<number>([f.roomPerDay, f.opd as number, f.renewalToAge, 35, h.total, ...h.ranked.slice(0, 5).map((r) => r.count)]);
    for (const x of scenes("GOLD").filter((y) => isDevice(y.show))) expect(checkDevice(x.show, only), x.show.layout).toEqual(x.show);
  });

  it("a number on screen is the sheet's, the age's or the list's, and nothing is typed in", () => {
    const h = hospitalCounts();
    for (const plan of ["GOLD", "SMART", "PLATINUM"]) {
      const allowed = new Set<number>([roomOf(plan), ...(typeof opdOf(plan) === "number" ? [opdOf(plan) as number] : []), 98, 35, h.total, ...h.ranked.slice(0, 5).map((r) => r.count)]);
      for (const s of scenes(plan)) {
        for (const [k, v] of Object.entries(s.show)) if (typeof v === "number") expect(allowed.has(v), `${plan} ${s.show.layout} ${k}`).toBe(true);
      }
    }
  });
});

describe("ipdopd: no percent, no return word, no promise", () => {
  const all = (plan: string) => {
    const inp = input(plan);
    // knowText is left out: it is the font's glyph set (every digit and "%"), not what is said or shown
    return [...scenes(plan).flatMap((s) => [JSON.stringify(s.show), s.voice]), knowEpisode(inp).cta, storyCaption(inp), ...storyScript(inp).map((s) => s.voice)].join("\n");
  };
  it("keeps clear of '%' and of every word the script forbids", () => {
    for (const plan of ["GOLD", "SMART", "PLATINUM"]) {
      const text = all(plan);
      expect(text, plan).not.toContain("%");
      // the spec's own renew98 voice says "เบี้ยปรับตามช่วงอายุ" (the premium word the brief scripts of คลิปตามโจทย์ forbid, a health episode like agecost uses)
      for (const f of FORBIDDEN.filter((x) => !/เบี้ย/.test(x.why))) expect(f.re.test(text), `${plan} ${f.why}`).toBe(false);
      expect(text).not.toMatch(/เบี้ยเท่าเดิม|ต่อได้แน่นอน|irr/i);
    }
  });

  it("says no digit but the baht the way every health voice writes them (withBaht), and every voice is in the female ending", () => {
    for (const plan of ["GOLD", "SMART", "PLATINUM"]) for (const s of scenes(plan)) {
      // an amount is "9,000 บาท": the one digit form the TTS reads as money; the renewal age is in words
      expect(s.voice.replace(/\d[\d,]* บาท/g, ""), `${plan} ${s.show.layout}`).not.toMatch(/\d/);
      expect(s.voice).toMatch(/ค่ะ|คะ/);
    }
  });

  it("the OPD voice for 'none' and 'actual' carries no figure and keeps ตามเงื่อนไข for as-paid", () => {
    expect(scenes("SMART")[1].voice).not.toContain("ต่อปี");
    expect(scenes("PLATINUM")[1].voice).toContain("ตามเงื่อนไข");
  });

  it("the caption is the health shelf's: an example off the sheet, no premium said", () => {
    const c = storyCaption(input("GOLD"));
    expect(c.split("\n")[0]).toMatch(/ผู้ป่วยใน/);
    expect(c).toContain("*ตัวเลขในคลิปเป็นตัวอย่างจาก iHealthy Gold");
    expect(c).toContain("#ประกันสุขภาพ");
    expect(c).not.toContain("เบี้ย");
  });
});

describe("ipdopd: every look the health shelf offers draws every scene", () => {
  const contact = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
  const LOOKS: { art?: string; extra?: Record<string, unknown> }[] = [
    {}, { art: "paper" }, { art: "line" }, { art: "info" }, { art: "plot" }, { art: "board" }, { art: "neon" }, { art: "blueprint" },
    { art: "minimal", extra: { cast: { hero: DEFAULT_CAST.hero.F, narrator: DEFAULT_CAST.narrator } } },
  ];
  it("offers the info looks on its shelf", () => {
    for (const art of ["info", "plot", "board", "neon", "blueprint"]) expect(input("GOLD", { art })).toMatchObject({ art });
  });
  for (const look of LOOKS) {
    for (const plan of ["GOLD", "SMART", "PLATINUM"]) {
      it(`${look.art ?? "the default look"} · ${plan}: every scene, in every shape`, () => {
        for (const size of ["portrait", "square", "landscape"] as const) {
          const clip = input(plan, { ...(look.art ? { art: look.art } : {}), ...look.extra, size });
          for (const s of storyScript(clip)) {
            const c: StoryContext = { input: clip, size, customer: "", narrator: "F", contact, crowd: [], faces: {}, words: s.voice.split(" "), voiceSec: 5 };
            for (const t of [0.3, 1.5, 7]) {
              const out = renderToStaticMarkup(clipFrame(s.key, c, t));
              expect(out.length, `${look.art} ${plan} ${size} ${s.key}`).toBeGreaterThan(400);
              expect(out).not.toContain("NaN");
            }
          }
        }
      });
    }
  }
});
