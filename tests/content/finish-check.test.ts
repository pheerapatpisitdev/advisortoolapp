import { describe, expect, it } from "vitest";
import {
  MOBILE_LINE, cleanTicks, finishChecks, formulaBadge, paragraphs, ticksFor, visibleLength, type FinishFormat,
} from "@/lib/content/finish-check";
import type { ContentOutput } from "@/lib/content/output";

/** สูตรอ่าน-ดูจนจบ's checklist: what the code can read of the guides' own checklists. */

const post = (over: Partial<ContentOutput> = {}): ContentOutput => ({
  hooks: ["ค่าห้อง 4,000 ในกรมธรรม์ โรงพยาบาลคิด 6,500"],
  body: "จุดที่คนข้ามคือค่าห้องต่อคืน\n\nเช็กเลขนี้เทียบกับโรงพยาบาลที่ไปจริง",
  closing: "เก็บไว้เช็กกรมธรรม์ตัวเองได้เลย",
  hashtags: [], imagePrompt: "", disclaimer: "",
  formula: "finish",
  loops: [{ open: "ค่าห้อง 4,000", close: "ค่าห้องต่อคืน" }],
  ...over,
});
const script = (body: string, over: Partial<ContentOutput> = {}) => post({
  hooks: ["จุดที่คนข้ามในตารางผลประโยชน์"],
  body,
  closing: "[40–45 วิ] เอาไปเช็กได้เลย (ชี้กล้อง)",
  loops: [{ open: "จุดที่คนข้าม", close: "เช็กได้" }],
  ...over,
});
const check = (o: ContentOutput, id: string, format: FinishFormat = "post") => finishChecks(o, format).find((r) => r.id === id)!;

describe("a clean piece", () => {
  it("passes all eight on a post, and a post is not read for a script's checks", () => {
    const r = finishChecks(post(), "post");
    expect(r.map((x) => x.id)).toEqual(["no-preamble", "hook-short", "para-lines", "run-lines", "lead-words", "jargon", "list-count", "loops-closed"]);
    expect(r.filter((x) => !x.ok)).toEqual([]);
  });

  it("gives a script all ten", () => {
    const r = finishChecks(script("[3–10 วิ] เบี้ย 1,200 บาทต่อเดือน {จอ: 1,200 บาท/เดือน} (ภาพใกล้)"), "script");
    expect(r).toHaveLength(10);
    expect(r.filter((x) => !x.ok)).toEqual([]);
  });
});

describe("Thai on a phone", () => {
  it("counts a vowel or tone mark above or below a letter as no width", () => {
    expect(visibleLength("ผู้")).toBe(1);
    expect(visibleLength("ที่")).toBe(1);
    expect(visibleLength("กำ")).toBe(2);
  });

  it("splits paragraphs at blank lines, and makes each list item its own", () => {
    expect(paragraphs("ก\nข\n\n- ค\n- ง\nจ")).toEqual(["ก\nข", "- ค", "- ง", "จ"]);
  });

  it("fails a paragraph past four lines, and not a long list of short items", () => {
    expect(check(post({ body: Array(4).fill("ก".repeat(MOBILE_LINE)).join("\n") }), "para-lines").ok).toBe(true);
    expect(check(post({ body: Array(5).fill("ก".repeat(MOBILE_LINE)).join("\n") }), "para-lines").ok).toBe(false);
    expect(check(post({ body: Array(8).fill("- ข้อสั้น").join("\n") }), "para-lines").ok).toBe(true);
  });

  it("fails a run of words past two lines, but not a hashtag", () => {
    const r = check(post({ body: "ก".repeat(MOBILE_LINE * 2 + 1) }), "run-lines");
    expect(r.ok).toBe(false);
    expect(r.where).toHaveLength(1);
    expect(check(post({ body: `#${"ก".repeat(100)}` }), "run-lines").ok).toBe(true);
  });
});

describe("how it opens", () => {
  it("fails a greeting or a preamble, a script's time marker aside", () => {
    expect(check(post({ hooks: ["สวัสดีครับ วันนี้มาคุยเรื่องประกัน"] }), "no-preamble").ok).toBe(false);
    expect(check(post({ hooks: ["[0–3 วิ] วันนี้จะมาเล่าเรื่องค่าห้อง"] }), "no-preamble").ok).toBe(false);
  });

  it("reads only what a script's hook says, not its screen text or its shot", () => {
    const hooks = ["ค่าห้องในกรมธรรม์กับที่โรงพยาบาลคิดจริง ต่างกันตรงไหน {จอ: เบี้ย 1,200 บาท/เดือน} (ตัดเป็นภาพใกล้ใบเสร็จโรงพยาบาล)"];
    expect(check(script("[3–8 วิ] สั้น", { hooks }), "hook-short", "script").ok).toBe(true);
    expect(check(script("[3–8 วิ] สั้น", { hooks: ["(ยิ้มเข้ากล้อง) สวัสดีครับ วันนี้มาคุยเรื่องค่าห้อง"] }), "no-preamble", "script").ok).toBe(false);
  });

  it("fails a hook past eighty visible characters", () => {
    expect(check(post({ hooks: ["ก".repeat(81)] }), "hook-short").ok).toBe(false);
    expect(check(post({ hooks: ["ที่".repeat(80)] }), "hook-short").ok).toBe(true);
  });

  it("fails a paragraph that opens on an empty word, past its bullet", () => {
    const r = check(post({ body: "ซึ่งแบบนี้คุ้มครอง\n\n- และยังมีอีก\n\n✅ ทบทวนกรมธรรม์ทุกปี" }), "lead-words");
    expect(r.ok).toBe(false);
    expect(r.where).toHaveLength(2);
  });
});

describe("technical words", () => {
  it("want a meaning right after, or around them in brackets", () => {
    expect(check(post({ body: "ดู IRR ของกรมธรรม์" }), "jargon").where).toEqual(["IRR"]);
    expect(check(post({ body: "ดู IRR (ผลตอบแทนเฉลี่ยต่อปี)" }), "jargon").ok).toBe(true);
    expect(check(post({ body: "IRR คือผลตอบแทนต่อปี" }), "jargon").ok).toBe(true);
    expect(check(post({ body: "ค่ารักษาผู้ป่วยใน (IPD)" }), "jargon").ok).toBe(true);
    expect(check(post({ body: "มี Co-Payment 30% ทุกเคลม" }), "jargon").ok).toBe(false);
  });
});

describe("a hook that promises a count", () => {
  it("wants each item in the body", () => {
    const hooks = ["3 จุดที่คนข้ามในตาราง"];
    expect(check(post({ hooks, body: "1. ค่าห้อง\n2. ค่าผ่าตัด" }), "list-count").where[0]).toContain("ข้อ 3");
    expect(check(post({ hooks, body: "1. ค่าห้อง\n2. ค่าผ่าตัด\n3. ค่ายา" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks, body: "ข้อแรก ค่าห้อง ข้อสอง ค่าผ่าตัด ข้อสาม ค่ายา" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks: ["๓ ข้อที่ต้องเช็ก"], body: "1️⃣ ค่าห้อง\n2️⃣ ค่าผ่าตัด\n3️⃣ ค่ายา" }), "list-count").ok).toBe(true);
  });

  it("takes a list of bullets, items named in words, or numbers inline, as the writers are told to write them", () => {
    expect(check(post({ hooks: ["3 เหตุผลที่เคลมไม่ผ่าน"], body: "✅ แถลงสุขภาพไม่ครบ\n✅ ยังไม่พ้นระยะรอคอย\n✅ เอกสารไม่ครบ" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks: ["2 อย่างที่ต้องเช็ก"], body: "อย่างแรก ค่าห้อง อย่างที่สอง ค่าผ่าตัด" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks: ["3 จุดที่คนข้าม"], body: "เช็กสามจุดนี้ 1. ค่าห้อง 2. ค่าผ่าตัด 3. ค่ายา" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks: ["3 จุดที่คนข้าม"], body: "✅ ค่าห้อง\n✅ ค่าผ่าตัด" }), "list-count").ok).toBe(false);
    expect(check(post({ hooks: ["3 จุดที่คนข้าม"], body: "ทุน 1.5 ล้าน 2. ค่าผ่าตัด" }), "list-count").ok).toBe(false);
  });
});

describe("loops", () => {
  it("fail when the writer reported none", () => {
    const r = check(post({ loops: undefined }), "loops-closed");
    expect(r.ok).toBe(false);
    expect(r.where).toEqual(["ไม่มีข้อมูลลูป ตรวจเองนะครับ"]);
  });

  it("fail as soon as an edit takes the closing words out, or puts them first", () => {
    expect(check(post({ body: "เช็กเลขนี้เทียบกับโรงพยาบาลที่ไปจริง" }), "loops-closed").ok).toBe(false);
    expect(check(post({ loops: [{ open: "ค่าห้องต่อคืน", close: "ค่าห้อง 4,000" }] }), "loops-closed").ok).toBe(false);
  });
});

describe("a script's own checks", () => {
  it("want every amount said on the screen of its own stretch", () => {
    const r = check(script("[3–10 วิ] เบี้ย 1,200 บาทต่อเดือน (ภาพใกล้)"), "numbers-on-screen", "script");
    expect(r.ok).toBe(false);
    expect(r.where[0]).toContain("3–10 วิ");
    expect(check(script("[3–10 วิ] มี 3 จุด (ภาพใกล้)"), "numbers-on-screen", "script").ok).toBe(true);
  });

  it("want a change of picture in any stretch longer than seven seconds", () => {
    expect(check(script("[3–15 วิ] พูดยาวไม่มีภาพเปลี่ยน"), "cuts", "script").ok).toBe(false);
    expect(check(script("[3–15 วิ] พูดยาว (ตัดเป็นภาพใกล้)"), "cuts", "script").ok).toBe(true);
    expect(check(script("[3–8 วิ] สั้น"), "cuts", "script").ok).toBe(true);
  });
});

describe("the agent's ticks", () => {
  it("ask a script whether it reads muted, and a post not", () => {
    expect(ticksFor("script").map((t) => t.id)).toContain("muted");
    expect(ticksFor("post").map((t) => t.id)).not.toContain("muted");
    expect(ticksFor("ad")).toEqual([]);
  });

  it("keep only the format's own, once each", () => {
    expect(cleanTicks(["no-fear", "muted", "junk", "no-fear", 3], "post")).toEqual(["no-fear"]);
    expect(cleanTicks("no-fear", "post")).toEqual([]);
    expect(cleanTicks(["no-fear"], "ad")).toEqual([]);
  });
});

describe("the card's label", () => {
  it("names the formula, with the score for สูตรอ่าน-ดูจนจบ", () => {
    expect(formulaBadge(post(), "post")).toBe("สูตรอ่าน-ดูจนจบ · ตรวจ 8/8");
    expect(formulaBadge(post({ formula: undefined, pro: true }), "post")).toBe("สูตรโปร");
    expect(formulaBadge(post({ formula: undefined }), "post")).toBe("");
  });
});

describe("an English piece", () => {
  const out = {
    hooks: ["Today we want to talk about cover"], body: "1. a\n2. b", closing: "", hashtags: [], imagePrompt: "",
    disclaimer: "", lang: "en" as const, formula: "finish" as const,
  } satisfies ContentOutput;
  const c = (o: ContentOutput, id: string) => finishChecks(o, "post").find((r) => r.id === id)?.ok;

  it("flags an English preamble hook and holds an English count to its list", () => {
    expect(c(out, "no-preamble")).toBe(false);
    expect(c({ ...out, hooks: ["today we…"] }, "no-preamble")).toBe(false);
    // the hook promises 3, the body lists 2
    expect(c({ ...out, hooks: ["3 reasons to look again"] }, "list-count")).toBe(false);
    expect(c({ ...out, hooks: ["Cover that stays"], body: "However, it renews." }, "lead-words")).toBe(false);
  });

  it("lets a plain English opening and a kept count pass", () => {
    expect(c({ ...out, hooks: ["Cover that stays"] }, "no-preamble")).toBe(true);
    expect(c({ ...out, hooks: ["2 reasons to look again"] }, "list-count")).toBe(true);
    expect(c({ ...out, hooks: ["Cover that stays"], body: "Whichever plan you pick, it renews." }, "lead-words")).toBe(true);
  });
});
