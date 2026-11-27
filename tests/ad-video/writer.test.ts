import { beforeEach, describe, expect, it, vi } from "vitest";

const replies: (string | Error)[] = [];
const prompts: string[] = [];
const tasks: string[] = [];
vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async (o: { task: string; messages: { content: string }[] }) => {
    prompts.push(o.messages[0].content);
    tasks.push(o.task);
    const r = replies.shift();
    if (r instanceof Error || r === undefined) throw r ?? new Error("no reply");
    return { text: r, model: "fake-flash", provider: "fake", inputTokens: 1, outputTokens: 1, costThb: 0 };
  }),
}));

import { laneOf } from "@/lib/ai/lanes";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { fallbackLines } from "@/lib/quote-video/brief";
import { bodiesFor, fixedBody, fixedPlan, nextYear } from "@/lib/ad-video/plan";
import { AD_WRITER_TASK, rewriteAdPart, writeAdPlan } from "@/lib/ad-video/writer";

const TODAY = new Date("2026-11-22T00:00:00+07:00");
const LP: VideoInput = { variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 };
const IS: VideoInput = { product: "ISHIELD", variant: "WLCI20", age: 30, sex: "F", sumAssured: 1_000_000 };
const lp = quoteVideoFacts(LP, TODAY)!;
const is = quoteVideoFacts(IS, TODAY)!;
const next = nextYear(LP, TODAY);

const PRICE = "ออมแค่วันละ 79 บาท ออม 19 ปีก็ครบค่ะ";
const VALUE = "พออายุ 64 ขอเงินก้อนคืนได้ 553,000 บาท มากกว่าที่ออมไปค่ะ";
const good = {
  hook: { kind: "shock", voice: "วันละ 79 บาท = เงินก้อน 2 ล้าน", headline: ["วันละ 79 บาท", "แลกเงินก้อน 2 ล้าน"] },
  body: [{ key: "price", voice: PRICE }, { key: "value", voice: VALUE }],
  cta: { key: "chat", voice: "บอกอายุมาในแชท เดี๋ยวส่งใบเสนอให้นะคะ" },
  photos: {
    hook: "a young father holding his baby at home, warm evening light",
    close: "a happy family on a sofa, soft daylight",
    body: ["a couple at a kitchen table with a notebook", "an older man smiling in a garden"],
  },
};
const reply = (over: Record<string, unknown> = {}) => JSON.stringify({ ...good, ...over });

beforeEach(() => { replies.length = 0; prompts.length = 0; tasks.length = 0; });

describe("writeAdPlan", () => {
  it("keeps a good plan the model wrote", async () => {
    replies.push(reply());
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next, brief: "เน้นเงินไม่หาย" });
    expect(prompts).toHaveLength(1);
    expect(tasks).toEqual([AD_WRITER_TASK]);
    expect(p.hook).toEqual(good.hook);
    expect(p.body).toEqual(good.body);
    expect(p.cta).toEqual(good.cta);
    // ค draws the first and last scene only, so the body ideas are not kept
    expect(p.photos).toEqual({ hook: good.photos.hook, close: good.photos.close });
    expect(p).toMatchObject({ mode: "ai", art: "mixed", brief: "เน้นเงินไม่หาย", written: true, model: "fake-flash" });
    // the prompt carries the quote's own figures, next year's figure, the agent's brief and the house rules
    expect(prompts[0]).toMatch(/ตกวันละ: 79 บาท/);
    expect(prompts[0]).toMatch(/วันละ 81 บาท/);
    expect(prompts[0]).toMatch(/ตัวแทนอยากเน้น: เน้นเงินไม่หาย/);
    expect(prompts[0]).toMatch(/ห้ามใช้คำว่า เบี้ย/);
    expect(prompts[0]).toMatch(/nextyear/);
    // the closings are offered by what they say, never by a screen name that says เบี้ย
    expect(prompts[0]).not.toMatch(/เบี้ยขึ้น/);
  });

  it("does not offer next year's closing when the price does not rise", async () => {
    replies.push(reply());
    await writeAdPlan(lp, { art: "mixed", mode: "ai", next: undefined });
    expect(prompts[0]).not.toMatch(/nextyear/);
  });

  it("asks once more with the reason and keeps what passed", async () => {
    replies.push(reply({ body: [{ key: "price", voice: "วันละ 59 บาท ก็มีเงินก้อนให้ครอบครัวค่ะ" }, { key: "value", voice: VALUE }] }));
    // the second answer rewrites the hook too: the first hook passed, so it stays
    replies.push(reply({ hook: { kind: "question", voice: "ถ้าพรุ่งนี้คุณไม่อยู่ ใครดูแลบ้านคะ", headline: ["ใครดูแลบ้าน?"] }, body: [{ key: "price", voice: PRICE }, { key: "value", voice: "อีกประโยคค่ะ" }] }));
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/มีตัวเลข 59 ที่ไม่อยู่ในใบเสนอ/);
    // only the failing scene is asked for again; the rest is shown as it stands
    expect(prompts[1]).not.toMatch(/"cta":/);
    expect(prompts[1]).toContain(VALUE);
    expect(p.body).toEqual(good.body);
    expect(p.hook).toEqual(good.hook);
    expect(p.written).toBe(true);
  });

  it("takes the fixed line for a part that fails twice", async () => {
    const bad = { body: [{ key: "price", voice: "วันละ 59 บาท ค่ะ" }, { key: "value", voice: VALUE }] };
    replies.push(reply(bad), reply({ body: [{ key: "price", voice: "เบี้ยถูกมากค่ะ" }, { key: "value", voice: VALUE }] }));
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next });
    expect(prompts).toHaveLength(2);
    expect(p.body[0]).toEqual({ key: "price", voice: fixedBody(lp, "price") });
    expect(p.body[1]).toEqual({ key: "value", voice: VALUE });
    expect(p.written).toBe(true);
  });

  it("tells the ad in fixed lines when the model is down", async () => {
    replies.push(new Error("down"));
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next });
    expect(p).toEqual(fixedPlan(lp, { art: "mixed", mode: "ai", next }));
    expect(p.written).toBe(false);
  });

  it("keeps the round-one plan when the retry fails", async () => {
    replies.push(reply({ cta: { key: "chat", voice: "ทักมาดูเบี้ยได้เลยค่ะ" } }), new Error("timeout"));
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next });
    expect(p.hook).toEqual(good.hook);
    expect(p.cta.voice).toBe("บอกแค่อายุ ทักมาขอใบเสนอของคุณได้เลยนะคะ");
    expect(p.written).toBe(true);
  });

  it("keeps at most three bodies that fit the quote", async () => {
    const v = (k: "price" | "cover" | "versus") => fixedBody(is, k);
    replies.push(reply({
      hook: { kind: "question", voice: "ถ้าหมอบอกว่าเป็นโรคร้ายแรง คุณพร้อมไหมคะ", headline: ["ถ้าป่วยหนักวันนี้", "พร้อมไหม?"] },
      body: [{ key: "price", voice: v("price") }, { key: "value", voice: v("price") }, { key: "cover", voice: v("cover") }, { key: "versus", voice: v("versus") }, { key: "price", voice: v("price") }],
    }));
    const p = await writeAdPlan(is, { art: "motion", mode: "ai", next: undefined });
    expect(p.body.map((b) => b.key)).toEqual(["price", "cover", "versus"]);
    expect(p.body.every((b) => bodiesFor(is).includes(b.key))).toBe(true);
  });

  it("refuses a hook kind the model may not choose", async () => {
    replies.push(reply({ hook: { ...good.hook, kind: "own" } }));
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next });
    expect(p.hook.kind).not.toBe("own");
  });

  it("in pick mode keeps the agent's keys and their own hook as typed", async () => {
    const own = "ใครยังไม่มีประกันชีวิต ฟังทางนี้ค่ะ";
    // the model tries other keys and another hook: the agent's choice stands
    replies.push(reply({ hook: { kind: "shock", voice: "อื่น", headline: ["ใครยังไม่มี", "ประกันชีวิต?"] }, cta: { key: "meet", voice: "ทักมานัดคุยค่ะ" } }));
    const p = await writeAdPlan(lp, { art: "photo", mode: "pick", hook: "own", ownHook: own, body: ["value", "price"], cta: "line", next });
    expect(p.mode).toBe("pick");
    expect(p.hook).toEqual({ kind: "own", voice: own, headline: ["ใครยังไม่มี", "ประกันชีวิต?"] });
    expect(p.body).toEqual([{ key: "value", voice: VALUE }, { key: "price", voice: PRICE }]);
    expect(p.cta.key).toBe("line");
    expect(p.photos).toEqual(good.photos);
    expect(prompts[0]).toContain(own);
  });

  it("replaces the agent's own hook that breaks the rules, voice and headline together", async () => {
    replies.push(reply());
    const p = await writeAdPlan(lp, { art: "mixed", mode: "pick", hook: "own", ownHook: "เบี้ยถูกที่สุดค่ะ", body: ["price"], cta: "chat", next });
    const fixed = fallbackLines(lp, { hook: "question" });
    expect(p.hook).toEqual({ kind: "own", voice: fixed.hook, headline: fixed.headline });
  });

  it("puts the voice and headline back together when only one of them failed twice", async () => {
    const hook = { kind: "shock", voice: "วันละ 79 บาท = เงินก้อน 2 ล้าน", headline: ["วันละ 59 บาท"] };
    replies.push(reply({ hook }), reply({ hook }));
    const p = await writeAdPlan(lp, { art: "mixed", mode: "ai", next });
    const fixed = fallbackLines(lp, { hook: "shock" });
    expect(p.hook).toEqual({ kind: "shock", voice: fixed.hook, headline: fixed.headline });
  });
});

describe("rewriteAdPart", () => {
  const plan = { ...fixedPlan(lp, { art: "mixed", mode: "ai", next, body: ["price", "value"] }), written: true, model: "fake-flash" };

  it("rewrites one body and leaves the rest", async () => {
    replies.push(JSON.stringify({ body: [{ key: "value", voice: VALUE }] }));
    const p = await rewriteAdPart(lp, plan, "body2", next);
    expect(p.body).toEqual([plan.body[0], { key: "value", voice: VALUE }]);
    expect(p.hook).toEqual(plan.hook);
    expect(p.cta).toEqual(plan.cta);
    expect(prompts[0]).toContain(plan.body[0].voice);
  });

  it("rewrites the hook", async () => {
    replies.push(JSON.stringify({ hook: good.hook }));
    const p = await rewriteAdPart(lp, plan, "hook", next);
    expect(p.hook).toEqual(good.hook);
    expect(p.body).toEqual(plan.body);
  });

  it("returns the plan unchanged when the new line fails or the model is down", async () => {
    replies.push(JSON.stringify({ cta: { key: "chat", voice: "เบี้ยถูกค่ะ" } }), JSON.stringify({ cta: { key: "chat", voice: "วันละ 59 บาทค่ะ" } }));
    expect(await rewriteAdPart(lp, plan, "cta", next)).toEqual(plan);
    replies.push(new Error("down"));
    expect(await rewriteAdPart(lp, plan, "body1", next)).toEqual(plan);
    expect(await rewriteAdPart(lp, plan, "body7", next)).toEqual(plan);
  });
});

describe("lane", () => {
  it("is a video script task", () => {
    expect(laneOf("ad-video-script", "small")).toBe("video-script");
  });
});
