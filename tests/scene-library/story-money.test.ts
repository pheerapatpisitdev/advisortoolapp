import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkDevice } from "@/lib/prompt-story/check";
import { checkedStory, storyCaption, storyMoney, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { clipFrame } from "@/lib/quote-video/story-frames";
import {
  incomestopLost, isDevice, KNOW_KEYS, knowEpisode, knowText, lifeneedTotals, moneysplitRemainder, taxbackRefund,
  type KnowShow, type LifeShow,
} from "@/lib/quote-video/story-knowledge";
import { MONEY_CLOSE, moneyScenes, sourced, type MoneyTopic } from "@/lib/quote-video/story-money";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { TAX_FIGURES, TAX_RATES } from "@/lib/scene-library/tax-th";
import { INFO_SHELVES, MONEY_INPUTS, STORY_TOPICS } from "@/lib/story/topics";

const TOPICS: MoneyTopic[] = ["lifeneed", "ciincome", "taxback"];
/** the spec's scene order (docs/superpowers/specs/2026-11-14-devices-life-tax-design.md, คลิปเล่าเรื่อง: a new shelf) */
const ORDER: Record<MoneyTopic, string[]> = {
  lifeneed: ["ask", "lifeneed", "beneficiary", "moneysplit", "recap"],
  ciincome: ["ask", "incomestop", "cilump", "list", "recap"],
  taxback: ["ask", "taxcap", "taxback", "note", "recap"],
};
/** every input a topic takes, typed */
const FULL: Record<MoneyTopic, Record<string, number>> = {
  lifeneed: { debts: 2_000_000, expenses: 300_000, years: 10, education: 800_000, have: 3_000_000 },
  ciincome: { monthly: 30_000, months: 6, ciSum: 1_000_000 },
  taxback: { premium: 50_000, bracket: 20 },
};

const input = (topic: MoneyTopic, money?: unknown, over: Record<string, unknown> = {}): StoryVideoInput => {
  const s = checkedStory({ topic, faces: { narrator: "w26", hero: "w15" }, ...(money !== undefined ? { money } : {}), ...over } as never, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};

/** every number a value puts on screen: number fields, and digit runs in its words */
const numbersOf = (v: unknown): number[] => {
  const out: number[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "number") out.push(x);
    else if (typeof x === "string") for (const m of x.match(/\d[\d,]*/g) ?? []) out.push(Number(m.replace(/,/g, "")));
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.entries(x).forEach(([k, y]) => { if (k !== "layout") walk(y); });
  };
  walk(v);
  return out;
};
/** every figure a voice says: digit runs, "2.5 ล้าน" read as 2,500,000 */
const spokenNumbers = (voice: string): number[] =>
  [...voice.matchAll(/(\d[\d,]*(?:\.\d+)?)(\s*ล้าน)?/g)].map((m) => Number(m[1].replace(/,/g, "")) * (m[2] ? 1_000_000 : 1));

/** the figures code may work out from the inputs, beside the inputs themselves */
function derived(inp: StoryVideoInput): number[] {
  const out: number[] = [];
  for (const s of moneyScenes(inp.topic as MoneyTopic, inp)) {
    const show = s.show;
    if (show.layout === "lifeneed") {
      const t = lifeneedTotals(show);
      out.push(...t.blocks.map((b) => b.amount), ...[t.need, t.gap].filter((x): x is number => x !== undefined));
    }
    if (show.layout === "incomestop") { const l = incomestopLost(show); if (l !== undefined) out.push(l); }
    if (show.layout === "taxback") { const r = taxbackRefund(show); if (r !== undefined) out.push(r); }
    if (show.layout === "moneysplit") { const r = moneysplitRemainder(show); if (r !== undefined) out.push(r); }
  }
  return out;
}

describe("the ทุนชีวิต ภาษี มรดก shelf", () => {
  it("lists three topics, offers the info-route looks, and takes no plan", () => {
    const money = STORY_TOPICS.filter((t) => t.shelf === "money");
    expect(money.map((t) => t.key)).toEqual(TOPICS);
    expect(money.map((t) => t.name)).toEqual(["ทุนชีวิตเท่าไหร่ถึงพอ", "ป่วยหนัก รายได้หายไปไหน", "เบี้ยประกันลดหย่อนได้เท่าไหร่"]);
    for (const t of money) expect(t.figure).toBeNull();
    expect(INFO_SHELVES).toContain("money");
    for (const art of ["plot", "board", "neon", "blueprint"]) expect(input("taxback", undefined, { art })).toMatchObject({ art });
  });

  it("names each topic's inputs as the spec does", () => {
    expect(MONEY_INPUTS.lifeneed.map((f) => f.label)).toEqual(["หนี้คงเหลือ", "ค่าใช้จ่ายครอบครัวต่อปี", "จำนวนปีที่ต้องดูแล", "ค่าการศึกษาลูก", "ทุนประกันที่มีอยู่"]);
    expect(MONEY_INPUTS.ciincome.map((f) => f.label)).toEqual(["รายได้ต่อเดือน", "จำนวนเดือนที่หยุดรักษา", "ทุนโรคร้ายแรง"]);
    expect(MONEY_INPUTS.taxback.map((f) => f.label)).toEqual(["เบี้ยประกันชีวิตต่อปี"]);
  });

  for (const topic of TOPICS) {
    it(`${topic}: five scenes in the spec's order, with and without inputs`, () => {
      for (const money of [FULL[topic], undefined]) {
        const scenes = moneyScenes(topic, input(topic, money));
        expect(scenes.map((s) => s.key)).toEqual(KNOW_KEYS);
        expect(scenes.map((s) => s.show.layout)).toEqual(ORDER[topic]);
        for (const s of scenes) expect(s.voice.length).toBeGreaterThan(10);
      }
      expect(MONEY_CLOSE[topic]).toMatch(/ทักมา/);
    });

    it(`${topic}: runs through knowEpisode and storyScript with its close`, () => {
      const e = knowEpisode(input(topic, FULL[topic]));
      expect(e.scenes).toHaveLength(5);
      expect(e.cta).toBe(MONEY_CLOSE[topic]);
      expect(knowText(e).length).toBeGreaterThan(0);
      expect(storyScript(input(topic)).map((s) => s.key)).toEqual([...KNOW_KEYS, "storyContact"]);
    });

    it(`${topic}: every device passes checkDevice with the typed inputs as its only source (the split: and the need worked out from them)`, () => {
      const inp = input(topic, FULL[topic]);
      const typedOnly = new Set(Object.values(FULL[topic]));
      // fix round 1 ruling: moneysplit splits the needed cover, so its total and parts are lifeneed's blocks and need
      const need = moneyScenes(topic, inp).find((x) => x.show.layout === "lifeneed")?.show as LifeShow<"lifeneed"> | undefined;
      const t = need ? lifeneedTotals(need) : undefined;
      const withNeed = new Set([...typedOnly, ...(t ? [...t.blocks.map((b) => b.amount), t.need!] : [])]);
      for (const s of moneyScenes(topic, inp).filter((x) => isDevice(x.show))) {
        expect(checkDevice(s.show, s.show.layout === "moneysplit" ? withNeed : typedOnly), `${topic} ${s.show.layout}`).toEqual(s.show);
      }
    });

    it(`${topic}: every figure on screen and in the voice is typed, worked out from what was typed, or the tax table's`, () => {
      const inp = input(topic, FULL[topic]);
      const allowed = new Set<number>([...Object.values(FULL[topic]), ...derived(inp), ...(topic === "taxback" ? TAX_FIGURES : [])]);
      for (const s of moneyScenes(topic, inp)) {
        for (const x of numbersOf(s.show)) expect(allowed.has(x), `${topic} ${s.show.layout} screen ${x}`).toBe(true);
        for (const x of spokenNumbers(s.voice)) expect(allowed.has(x), `${topic} ${s.show.layout} voice ${x}`).toBe(true);
      }
    });

    it(`${topic}: with nothing typed still makes the clip, every device in its words-only form, no figure said (Review Focus 5)`, () => {
      const inp = input(topic);
      expect(inp.money).toBeUndefined();
      const scenes = moneyScenes(topic, inp);
      for (const s of scenes) {
        expect(spokenNumbers(s.voice), `${topic} ${s.show.layout} voice`).toEqual([]);
        if (isDevice(s.show)) {
          // a device's own number fields are all left off (taxcap draws the table's, which is no input)
          const own = Object.entries(s.show).filter(([, v]) => typeof v === "number");
          expect(own, `${topic} ${s.show.layout}`).toEqual([]);
          expect(numbersOf(s.show).filter((x) => !TAX_FIGURES.has(x)), `${topic} ${s.show.layout}`).toEqual([]);
        }
      }
      // and it draws: every scene, in the paper look and the plotter's
      const contact = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
      for (const art of ["paper", "plot"]) {
        const clip = input(topic, undefined, { art });
        for (const s of storyScript(clip)) {
          const c: StoryContext = { input: clip, size: "portrait", customer: "", narrator: "F", contact, crowd: [], faces: {}, words: s.voice.split(" "), voiceSec: 5 };
          expect(renderToStaticMarkup(clipFrame(s.key, c, 7)).length, `${topic} ${art} ${s.key}`).toBeGreaterThan(400);
        }
      }
    });
  }

  it("lifeneed: the agent's numbers fill the blocks; the split is of the needed cover, so it agrees with the gap", () => {
    const scenes = moneyScenes("lifeneed", input("lifeneed", FULL.lifeneed));
    expect(scenes[1].show).toMatchObject({ layout: "lifeneed", debts: 2_000_000, expenses: 300_000, years: 10, education: 800_000, have: 3_000_000 });
    expect(lifeneedTotals(scenes[1].show as LifeShow<"lifeneed">)).toMatchObject({ need: 5_800_000, gap: 2_800_000 });
    expect(scenes[1].voice).toMatch(/2,800,000|2\.8 ล้าน/);
    // no share is typed on this form: the names are drawn alone
    const ben = scenes[2].show as LifeShow<"beneficiary">;
    expect(ben.rows.length).toBeGreaterThan(0);
    for (const r of ben.rows) expect(r.share).toBeUndefined();
    expect(scenes[3].show).toEqual({
      layout: "moneysplit", title: ["ทุนที่ควรมี", "แบ่งไปใช้อะไร"], total: 5_800_000,
      parts: [{ label: "ปิดหนี้", amount: 2_000_000 }, { label: "ใช้จ่ายในบ้าน", amount: 3_000_000 }, { label: "ค่าเรียนลูก", amount: 800_000 }],
    });
    expect(moneysplitRemainder(scenes[3].show as LifeShow<"moneysplit">)).toBeUndefined();
    expect(scenes[3].voice).toBe("ทุนที่ควรมี 5.8 ล้านบาท มีไว้ทำสามอย่างค่ะ ปิดหนี้ 2 ล้านบาท ให้ครอบครัวใช้จ่ายในบ้านอีก 10 ปี 3 ล้านบาท เก็บเป็นค่าเรียนลูก 800,000 บาท ถ้ามีทุนเท่านี้ วันหนึ่งที่เราไม่อยู่ ครอบครัวก็ยังเดินต่อได้");
    // never the existing cover split as if it were enough
    expect(scenes[3].voice).not.toMatch(/3 ล้านบาท ปิดหนี้|ยังเหลือ/);
  });

  it("lifeneed: with little cover had, the split still shows the need, and no line says the cover pays the debts", () => {
    const scenes = moneyScenes("lifeneed", input("lifeneed", { ...FULL.lifeneed, have: 1_000_000 }));
    expect(scenes[1].voice).toMatch(/ยังขาดอีก 4\.8 ล้านบาท/);
    expect(scenes[3].show).toMatchObject({ total: 5_800_000 });
    for (const s of scenes) expect(s.voice).not.toMatch(/เงินก้อน 1 ล้านบาท|ทุน 1 ล้านบาท/);
  });

  it("lifeneed: two blocks typed split only those, and never call it the whole need", () => {
    const scenes = moneyScenes("lifeneed", input("lifeneed", { debts: 2_000_000, education: 800_000, have: 500_000 }));
    expect(scenes[3].show).toEqual({
      layout: "moneysplit", title: ["รวมที่กรอกไว้", "แบ่งไปใช้อะไร"], total: 2_800_000,
      parts: [{ label: "ปิดหนี้", amount: 2_000_000 }, { label: "ค่าเรียนลูก", amount: 800_000 }],
    });
    expect(scenes[3].voice).toBe("เฉพาะที่กรอกไว้ รวม 2.8 ล้านบาท มีไว้ปิดหนี้ 2 ล้านบาท และเก็บเป็นค่าเรียนลูก 800,000 บาทค่ะ ยังไม่รวมค่าใช้จ่ายที่ไม่ได้กรอก");
    expect(scenes[3].voice).not.toContain("ทุนที่ควรมี");
  });

  it("lifeneed: fewer than two blocks, the split is in words with no total", () => {
    for (const money of [undefined, { debts: 2_000_000, have: 3_000_000 }, { have: 3_000_000 }]) {
      const split = moneyScenes("lifeneed", input("lifeneed", money))[3];
      expect(split.show).toEqual({ layout: "moneysplit", title: ["เงินก้อนนี้", "ช่วยคนในบ้าน"], parts: [{ label: "ปิดหนี้" }, { label: "ใช้จ่ายในบ้าน" }, { label: "ค่าเรียนลูก" }] });
      expect(split.voice).toBe("ถ้าวันหนึ่งเราไม่อยู่ เงินก้อนจากประกัน ช่วยปิดหนี้ เป็นค่าใช้จ่ายในบ้าน และค่าเรียนลูกค่ะ");
    }
  });

  it("lifeneed: a partial form draws only what was typed", () => {
    const show = moneyScenes("lifeneed", input("lifeneed", { debts: 2_000_000 }))[1].show;
    expect(show).toEqual({ layout: "lifeneed", title: expect.any(Array), debts: 2_000_000 });
  });

  it("ciincome: the income line, the months and the CI sum come from the form", () => {
    const scenes = moneyScenes("ciincome", input("ciincome", FULL.ciincome));
    expect(scenes[1].show).toMatchObject({ layout: "incomestop", monthly: 30_000, months: 6 });
    expect(scenes[1].voice).toContain("180,000");
    expect(scenes[2].show).toMatchObject({ layout: "cilump", sum: 1_000_000 });
    expect(scenes[3].show).toMatchObject({ layout: "list", title: ["ค่าใช้จ่ายที่ยังเดิน", "ระหว่างรักษา"] });
  });

  it("taxback: the chip's rate is highlighted and the refund worked out, the note states the conditions", () => {
    const scenes = moneyScenes("taxback", input("taxback", FULL.taxback));
    expect(scenes[1].show).toEqual({ layout: "taxcap", title: expect.any(Array) });
    expect(scenes[2].show).toMatchObject({ layout: "taxback", premium: 50_000, bracket: 20 });
    expect(scenes[2].show).toMatchObject({ title: ["ภาษีที่ได้คืน", "ตามฐานภาษี"] });
    expect(scenes[2].voice).toBe("ถ้าจ่ายเบี้ยประกันชีวิตปีละ 50,000 บาท ฐานภาษี 20 เปอร์เซ็นต์ ได้ภาษีคืนราว 10,000 บาทค่ะ");
    const note = scenes[3].show as Extract<KnowShow, { layout: "note" }>;
    const words = note.note.map((l) => l.text).join(" ");
    expect(words).toContain("กรมธรรม์ต้องมีระยะเวลาคุ้มครอง 10 ปีขึ้นไป");
    expect(words).toContain("นำไปหักลดหย่อนในแบบ ภ.ง.ด.");
    // no promise beyond the deduction
    for (const s of scenes) expect(`${JSON.stringify(s.show)} ${s.voice}`).not.toMatch(/ปลอดภาษี|ผลตอบแทน|การันตี/);
  });

  it("taxback: a premium alone draws the ladder with no rate picked; a rate alone says no refund", () => {
    const premium = moneyScenes("taxback", input("taxback", { premium: 50_000 }))[2];
    expect(premium.show).toEqual({ layout: "taxback", title: expect.any(Array), premium: 50_000 });
    const rate = moneyScenes("taxback", input("taxback", { bracket: 30 }))[2];
    expect(rate.show).toEqual({ layout: "taxback", title: expect.any(Array), bracket: 30 });
    expect(spokenNumbers(rate.voice).every((x) => x === 30)).toBe(true);
  });

  it("taxback says ได้คืน, as the device draws it, never another word for the refund", () => {
    for (const money of [FULL.taxback, { premium: 50_000 }, { bracket: 30 }, undefined]) {
      const s = moneyScenes("taxback", input("taxback", money))[2];
      expect(s.voice).toMatch(/ได้(ภาษี)?คืน/);
      expect(`${JSON.stringify(s.show)} ${s.voice}`).not.toMatch(/ลดได้|ภาษีจะลดลง|ภาษีก็ยิ่งลดลง/);
    }
    expect(STORY_TOPICS.find((t) => t.key === "taxback")!.blurb).toContain("ได้คืน");
    expect(storyCaption(input("taxback"))).toContain("ยิ่งได้คืนมาก");
  });

  it("no word of any topic promises a return or says ปลอดภาษี", () => {
    for (const topic of TOPICS) for (const money of [FULL[topic], undefined]) {
      for (const s of moneyScenes(topic, input(topic, money))) expect(`${JSON.stringify(s.show)} ${s.voice}`).not.toMatch(/ปลอดภาษี|ผลตอบแทน|การันตี|กำไร|ปันผล/);
    }
  });
});

describe("storyMoney: the typed numbers, checked", () => {
  it("keeps every input of the topic in range", () => {
    for (const topic of TOPICS) expect(storyMoney(topic, FULL[topic])).toEqual(FULL[topic]);
  });

  it("drops a number out of range, a fraction, nought, a negative, a string, and another topic's field", () => {
    const m = storyMoney("lifeneed", { debts: -1, expenses: 0, years: 2.5, education: "800000", have: 1e12, monthly: 30_000, bracket: 20 });
    expect(m).toBeUndefined();
    expect(storyMoney("lifeneed", { debts: 2_000_000, years: 51, have: 100_000_001 })).toEqual({ debts: 2_000_000 });
    expect(storyMoney("ciincome", { monthly: 10_000_001, months: 61, ciSum: 1_000_000 })).toEqual({ ciSum: 1_000_000 });
    expect(storyMoney("taxback", { premium: 50_000, debts: 1 })).toEqual({ premium: 50_000 });
  });

  it("keeps a bracket only when it is one of the table's rates", () => {
    for (const r of TAX_RATES) expect(storyMoney("taxback", { bracket: r })).toEqual({ bracket: r });
    for (const bad of [0, 12, 40, 5.5, "20", null]) expect(storyMoney("taxback", { bracket: bad }), String(bad)).toBeUndefined();
  });

  it("is nothing for a topic of another shelf, or for no object", () => {
    expect(storyMoney("pool48", FULL.lifeneed)).toBeUndefined();
    expect(storyMoney("lifeneed", null)).toBeUndefined();
    expect(storyMoney("lifeneed", [1, 2])).toBeUndefined();
  });

  it("checkedStory keeps the checked inputs on the clip's input, and drops what is forged rather than refusing the clip", () => {
    expect(input("taxback", { premium: 50_000, bracket: 12 }).money).toEqual({ premium: 50_000 });
    expect(input("lifeneed", { debts: -5 }).money).toBeUndefined();
    // a topic of another shelf carries none
    expect(input("declare" as MoneyTopic, FULL.lifeneed).money).toBeUndefined();
  });
});

describe("sourced: a device held to its sources", () => {
  it("keeps a device whose numbers were typed", () => {
    const show: KnowShow = { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 30_000, months: 6 };
    expect(sourced(show, new Set([30_000, 6]))).toEqual(show);
  });
  it("draws a device with a figure that was not typed in its words-only form", () => {
    const show: KnowShow = { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 30_000, months: 6 };
    expect(sourced(show, new Set([6]))).toEqual({ layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"] });
    const split: KnowShow = { layout: "moneysplit", title: ["เงินก้อนนี้", "ช่วยคนในบ้าน"], total: 9_000_000, parts: [{ label: "ปิดหนี้", amount: 1 }, { label: "ค่าเรียนลูก", amount: 2 }] };
    expect(sourced(split, new Set([1, 2]))).toEqual({ layout: "moneysplit", title: ["เงินก้อนนี้", "ช่วยคนในบ้าน"], parts: [{ label: "ปิดหนี้" }, { label: "ค่าเรียนลูก" }] });
  });
  it("drops a bracket that is not a table rate", () => {
    const show: KnowShow = { layout: "taxback", title: ["ภาษีที่ได้คืน", "ตามฐานภาษี"], premium: 50_000, bracket: 12 };
    expect(sourced(show, new Set([50_000, 12]))).toEqual({ layout: "taxback", title: ["ภาษีที่ได้คืน", "ตามฐานภาษี"], premium: 50_000 });
  });
});

describe("the captions of ทุนชีวิต ภาษี มรดก", () => {
  for (const topic of TOPICS) {
    it(`${topic}: says the figures are the agent's examples${topic === "taxback" ? ", and the Revenue Department's rules" : ""}`, () => {
      for (const money of [FULL[topic], undefined]) {
        const c = storyCaption(input(topic, money));
        expect(c).toContain("ตัวเลขในคลิปเป็นตัวอย่างจากที่ตัวแทนกรอก");
        const tax = "ตามเกณฑ์กรมสรรพากร ปีภาษี 2569 ตรวจสอบเงื่อนไขก่อนใช้สิทธิ";
        if (topic === "taxback") expect(c).toContain(tax);
        else expect(c).not.toContain(tax);
        expect(c).toContain("ทักมาคุยกันได้เลย");
        expect(c).not.toMatch(/ปลอดภาษี|ผลตอบแทน/);
        expect(c).toMatch(/#ประกันชีวิต/);
        expect(c).not.toContain("*เบี้ยในคลิปเป็นตัวอย่างจาก");
      }
    });
  }
});
