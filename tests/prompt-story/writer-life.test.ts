import { describe, expect, it, vi } from "vitest";
import { rewriteScene, writeStory } from "@/lib/prompt-story/writer";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { deviceAllowed } from "@/lib/prompt-story/check";
import { pictureCount } from "@/lib/prompt-story/editor-state";
import { pictureScenes, promptPicturesPrice, type DeviceScene } from "@/lib/prompt-story/types";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { LIFE_LAYOUTS, type LifeLayout, type LifeShow } from "@/lib/quote-video/story-knowledge";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

/**
 * The ชีวิต ภาษี มรดก devices in คลิปตามโจทย์ (device round 2, Task 6): the writer offers them with their
 * fields and sources, keeps one whose figures the brief or the plan give, and paints the scene of one
 * carrying a figure it made up (Review Focus 1), priced as a picture.
 */

const BRIEF = [
  "ลูกค้าอายุ 40 หนี้บ้านคงเหลือ 2,000,000 บาท ค่าใช้จ่ายครอบครัวปีละ 300,000 บาท ต้องดูแลอีก 15 ปี",
  "ค่าการศึกษาลูก 1,000,000 บาท มีทุนประกันอยู่แล้ว 1,500,000 บาท ผู้รับประโยชน์ ภรรยา 60 ลูก 40",
  "รายได้เดือนละ 50,000 บาท ป่วยหนักหยุดงาน 6 เดือน ทุนโรคร้ายแรง 1,000,000 บาท",
  "จ่ายค่าประกันชีวิตปีละ 60,000 บาท ฐานภาษี 20% แบ่งเงินก้อน 1,500,000 บาท ให้ภรรยา 1,000,000 บาท ลูก 500,000 บาท",
].join(" ");

/** one of each, every figure from BRIEF */
const GOOD: { [K in LifeLayout]: LifeShow<K> } = {
  lifeneed: { layout: "lifeneed", title: ["ทุนชีวิต", "ควรมีเท่าไหร่"], debts: 2_000_000, expenses: 300_000, years: 15, education: 1_000_000, have: 1_500_000 },
  beneficiary: { layout: "beneficiary", title: ["ผู้รับประโยชน์", "ใครได้รับเงิน"], rows: [{ name: "ภรรยา", share: 60 }, { name: "ลูก", share: 40 }] },
  cilump: { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"], sum: 1_000_000, note: "ใช้รักษาหรือทดแทนรายได้" },
  incomestop: { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 50_000, months: 6 },
  taxback: { layout: "taxback", title: ["ลดหย่อนภาษี", "ได้คืนเท่าไหร่"], premium: 60_000, bracket: 20 },
  taxcap: { layout: "taxcap", title: ["เพดานลดหย่อน", "ปีภาษี 2569"] },
  moneysplit: { layout: "moneysplit", title: ["แบ่งเงินก้อน", "ให้คนในบ้าน"], total: 1_500_000, parts: [{ label: "ภรรยา", amount: 1_000_000 }, { label: "ลูก", amount: 500_000 }] },
  threegen: { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["รุ่นปู่ย่า", "รุ่นพ่อแม่", "รุ่นลูก"], note: "ส่งต่อเงินก้อนให้ลูกหลาน" },
};

const sc = (o: Record<string, unknown> = {}) => ({ voice: "วางแผนให้ครอบครัวไปต่อได้ค่ะ", screen: "ครอบครัวไปต่อได้", picture: "ครอบครัวนั่งคุยกันในบ้าน", showFigure: false, ...o });
const reply = (scenes: unknown[]) => JSON.stringify({ onTopic: true, refusal: "", title: "ทุนชีวิตพอไหม", caption: "ลองเช็กกันค่ะ", scenes });
const write = async (scenes: unknown[], brief = BRIEF) => {
  const r = await writeStory({ brief, scenes: 3, ask: vi.fn().mockResolvedValue(reply(scenes)) });
  if (!r.ok) throw new Error("not ok");
  return r;
};

describe("writeStory with the ชีวิต ภาษี มรดก devices", () => {
  it("lists every device in the registry's order", () => {
    expect(Object.keys(GOOD)).toEqual([...LIFE_LAYOUTS]);
  });

  for (const key of LIFE_LAYOUTS) {
    it(`keeps a ${key} whose figures the brief gives, drawn in place of the picture`, async () => {
      const r = await write([sc(), sc({ picture: "", device: GOOD[key] }), sc()]);
      expect(r.scenes[1].device).toEqual(GOOD[key]);
      expect(r.scenes[1].picture).toBe("");
      expect(r.notes).toEqual([]);
    });
  }

  it("takes cilump's sum and moneysplit's total from the plan figure", async () => {
    const figure = { plan: "ISHIELD", variant: "x", sex: "F", age: 35, sumAssured: 2_500_000, annual: 18_000, monthly: 1_600 } as never;
    const ask = vi.fn().mockResolvedValue(reply([
      sc({ picture: "", device: { ...GOOD.cilump, sum: 2_500_000 } }),
      sc({ picture: "", device: { layout: "moneysplit", title: ["แบ่งเงินก้อน", ""], total: 2_500_000, parts: [{ label: "แม่" }, { label: "ลูก" }] } }),
      sc(),
    ]));
    const r = await writeStory({ brief: "ลูกสาวอยากมีเงินก้อนไว้ให้แม่", scenes: 5, figure, ask });
    if (!r.ok) throw new Error("not ok");
    expect(r.scenes[0].device).toMatchObject({ layout: "cilump", sum: 2_500_000 });
    expect(r.scenes[1].device).toMatchObject({ layout: "moneysplit", total: 2_500_000 });
  });

  // Review Focus 1: a figure the AI made up is never drawn; the scene is painted
  const FORGED: [string, Record<string, unknown>][] = [
    ["lifeneed debts not in the brief", { ...GOOD.lifeneed, debts: 2_500_000 }],
    ["beneficiary share not in the brief", { ...GOOD.beneficiary, rows: [{ name: "ภรรยา", share: 70 }, { name: "ลูก", share: 30 }] }],
    ["cilump sum not in the brief", { ...GOOD.cilump, sum: 3_000_000 }],
    ["incomestop months not in the brief", { ...GOOD.incomestop, months: 12 }],
    ["taxback premium not in the brief", { ...GOOD.taxback, premium: 80_000 }],
    ["taxback refund written in its title", { ...GOOD.taxback, title: ["ได้คืน 12,000 บาท", ""] }],
    ["taxcap refund written in its title", { ...GOOD.taxcap, title: ["ได้คืน 12,000 บาท", ""] }],
    ["moneysplit amount not in the brief", { ...GOOD.moneysplit, parts: [{ label: "ภรรยา", amount: 700_000 }, { label: "ลูก", amount: 500_000 }] }],
    ["threegen figure in its note", { ...GOOD.threegen, note: "ส่งต่อ 9,000,000 บาท" }],
    ["lifeneed gap written in its title", { ...GOOD.lifeneed, title: ["ขาดอีก 2,300,000", ""] }],
    ["taxback with เบี้ย in its words", { ...GOOD.taxback, title: ["เบี้ยประกัน", "ลดหย่อนได้"] }],
    ["taxcap with % in its words", { ...GOOD.taxcap, title: ["ลดหย่อน 15%", ""] }],
  ];
  for (const [what, device] of FORGED) {
    it(`${what}: the device is dropped and the scene painted`, async () => {
      const r = await write([sc({ picture: "", screen: "ภาษีได้คืน 60,000 บาท", device }), sc({ picture: "แม่กับลูกยิ้ม", device }), sc()]);
      expect(r.scenes[0].device).toBeUndefined();
      expect(r.scenes[0].picture).toBeTruthy();
      expect(r.scenes[0].picture).not.toMatch(/\d/);
      expect(r.scenes[1].device).toBeUndefined();
      expect(r.scenes[1].picture).toBe("แม่กับลูกยิ้ม");
      expect(r.notes).toEqual([]);
    });
  }

  it("a total, gap, loss, refund or remainder the writer adds is left off; the device is kept", async () => {
    // one device a write: three scenes hold one at most
    const extra: [DeviceScene, Record<string, unknown>][] = [
      [GOOD.lifeneed, { need: 99, gap: 7 }],
      [GOOD.incomestop, { lost: 123 }],
      [GOOD.taxback, { refund: 12_000, deductible: 60_000 }],
      [GOOD.moneysplit, { remainder: 1 }],
    ];
    for (const [d, add] of extra) {
      const r = await write([sc({ device: { ...d, ...add } }), sc(), sc()]);
      expect(r.scenes[0].device).toEqual(d);
    }
  });

  it("taxback's bracket only when the brief states the client's rate; else drawn without it", async () => {
    const noRate = "จ่ายค่าประกันชีวิตปีละ 60,000 บาท";
    const r = await write([sc({ device: GOOD.taxback }), sc(), sc()], noRate);
    expect(r.scenes[0].device).toEqual({ layout: "taxback", title: GOOD.taxback.title, premium: 60_000 });
    // a rate the brief gives but the table does not have is left off too
    const odd = await write([sc({ device: { ...GOOD.taxback, bracket: 12 } }), sc(), sc()], `${noRate} ฐานภาษี 12%`);
    expect(odd.scenes[0].device).toEqual({ layout: "taxback", title: GOOD.taxback.title, premium: 60_000 });
  });

  it("taxcap takes no figures: any it is given is left off", async () => {
    const r = await write([sc({ device: { ...GOOD.taxcap, cap: 100_000, rows: [1, 2] } }), sc(), sc()]);
    expect(r.scenes[0].device).toEqual(GOOD.taxcap);
  });

  it("a forged device in เขียนฉากนี้ใหม่ comes back a picture scene", async () => {
    const draft = [sc({ voice: "ฉากแรกค่ะ" }), sc({ voice: "ฉากสองค่ะ" }), sc({ voice: "ฉากสามค่ะ" })];
    const ok = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 1, ask: vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ picture: "", device: GOOD.incomestop }) })) });
    expect(ok.ok && ok.scene.device).toEqual(GOOD.incomestop);
    const forged = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 1, ask: vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ picture: "", device: { ...GOOD.incomestop, monthly: 45_000 } }) })) });
    expect(forged.ok && forged.scene.device).toBeFalsy();
    expect(forged.ok && forged.scene.picture).toBe("ครอบครัวไปต่อได้");
  });
});

describe("the system prompt for the ชีวิต ภาษี มรดก devices", () => {
  const systemOf = async (brief = BRIEF) => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
    await writeStory({ brief, scenes: 3, ask });
    return ask.mock.calls[0][0] as string;
  };

  it("says where each new device's figures come from, and that the system computes the rest", async () => {
    const system = await systemOf();
    expect(system).toContain("- taxcap: ไม่มีช่องตัวเลข ระบบวาดตารางเพดานลดหย่อนตามเกณฑ์กรมสรรพากรเอง");
    expect(system).toContain("- taxback: ใส่ bracket ได้เฉพาะเมื่อโจทย์บอกอัตราภาษีของลูกค้า และต้องเป็นอัตราตามโจทย์ ถ้าโจทย์ไม่บอกให้ละ bracket");
    expect(system).toContain("- ห้ามเขียนยอดที่ระบบคิดเอง ทั้งในช่องตัวเลขและในคำของอุปกรณ์: ยอดรวม ทุนที่ขาด รายได้ที่หาย ภาษีที่ได้คืน เงินที่เหลือ");
    expect(system).toContain("- คำที่เขียนในอุปกรณ์ทุกตัวห้ามมีคำต้องห้ามข้างบน แม้ระบบจะวาดคำอย่าง เบี้ยปีละ หรือ % บนอุปกรณ์เอง ให้ใช้ ค่าประกัน แทน เบี้ย");
    // the words the model may write in the new devices' fields
    expect(system).toMatch(/คำในอุปกรณ์ทุกช่อง \([^)]*\bname\b[^)]*\blabel\b[^)]*\)/);
    // never the tax table pasted in
    expect(system).not.toContain("150,001");
    expect(system).not.toContain("5,000,000");
  });

  it("its device heading is not health only, and its new lines are free of the words no script may say", async () => {
    const system = await systemOf();
    expect(system).not.toContain("อุปกรณ์สุขภาพ:");
    const lines = system.split("\n").filter((l) => LIFE_LAYOUTS.some((k) => l.startsWith(`- ${k} (`)));
    expect(lines).toHaveLength(8);
    for (const l of lines) for (const x of FORBIDDEN) expect(x.re.test(l), `${x.why}: ${l}`).toBe(false);
  });

  it("shows the brief's tax rate among the figures a device may use", async () => {
    expect((await systemOf()).split("\n").find((l) => l.startsWith("- ตัวเลขที่ใช้ในอุปกรณ์ได้:"))).toMatch(/\b20\b/);
  });
});

describe("checkedPromptStory and the price with the ชีวิต ภาษี มรดก devices", () => {
  const base = { draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "t", caption: "c", style: "paper", painter: "standard" };

  it("keeps the eight as devices, never charged as pictures", () => {
    const keys = [...LIFE_LAYOUTS];
    for (let i = 0; i < keys.length; i += 3) {
      const scenes = keys.slice(i, i + 3).map((k) => sc({ picture: "", device: GOOD[k] }));
      while (scenes.length < 3) scenes.push(sc());
      const form = checkedPromptStory({ ...base, scenes }, "F");
      if (typeof form === "string") throw new Error(form);
      keys.slice(i, i + 3).forEach((k, j) => expect(form.scenes[j].device).toEqual(GOOD[k]));
      expect(pictureScenes(form)).toBe(3 - keys.slice(i, i + 3).length);
    }
  });

  it("drops a forged device: the scene is painted and priced as a picture, as the editor counts it", () => {
    const scenes = [sc({ device: { ...GOOD.taxback, title: ["ได้คืน 12,000 บาท", ""] } }), sc({ picture: "", device: GOOD.lifeneed }), sc()];
    const form = checkedPromptStory({ ...base, scenes }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes[0].device).toBeUndefined();
    expect(form.scenes[1].device).toEqual(GOOD.lifeneed);
    expect(pictureScenes(form)).toBe(2);
    expect(pictureCount(scenes as never, deviceAllowed(BRIEF))).toBe(2);
    const one = promptPicturesPrice({ ...form, scenes: [form.scenes[2]] }, DEFAULT_PRICES);
    expect(promptPicturesPrice(form, DEFAULT_PRICES)).toBe(2 * one);
  });
});
