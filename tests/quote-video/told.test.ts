import { describe, expect, it } from "vitest";
import { allowedNumbers, cleanBrief, fallbackLines, lineProblem, numbersIn, storiesFor, writtenProblems, WRITTEN_HOOKS, type VideoBrief } from "@/lib/quote-video/brief";
import { quoteVideoFacts, quoteVideoScript, type VideoInput, type VideoLength } from "@/lib/quote-video/script";

const INPUTS: VideoInput[] = [
  { product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 },
  { product: "LIFEPROTECT", variant: "WLF99H", age: 40, sex: "F", sumAssured: 2_000_000 },
  { product: "ISHIELD", variant: "WLCI20", age: 35, sex: "M", sumAssured: 1_000_000 },
  { product: "IHEALTHY", age: 35, sex: "M", plan: "GOLD", compare: ["PLATINUM"] },
  { product: "PENSION", age: 40, sex: "F", annuityAge: 60, pay: "untilAnnuity", sumAssured: 1_000_000 },
];
const facts = (v: VideoInput) => {
  const f = quoteVideoFacts(v);
  if (!f) throw new Error(`no facts for ${v.product}`);
  return f;
};
// ดอกเบี้ย (interest) is not the premium the voice never names
const BANNED = /(?<!ดอก)เบี้ย|เสียชีวิต|เวนคืน/;

describe("the fixed lines a brief falls back on", () => {
  for (const v of INPUTS) {
    it(`pass their own checks — ${v.product}`, () => {
      const f = facts(v);
      for (const hook of WRITTEN_HOOKS) {
        for (const story of storiesFor(f)) {
          const w = fallbackLines(f, { hook, story: story.key, audience: "parents" });
          expect(writtenProblems(w, f, { loop: true, story: true })).toEqual({});
          expect(writtenProblems(w, f, { loop: false, story: true })).toEqual({});
        }
      }
    });
  }
});

describe("quoteVideoScript", () => {
  const lengths: VideoLength[] = ["short", "full", "long", "max"];
  for (const v of INPUTS) {
    for (const length of lengths) {
      for (const brief of [undefined, { hook: "question", audience: "parents" }, { hook: "shock", loop: true }] as (VideoBrief | undefined)[]) {
        it(`${v.product} ${length} ${brief?.hook ?? "plain"}${brief?.loop ? " loop" : ""}`, () => {
          const f = facts(v);
          const told = { brief: brief ? cleanBrief(brief, f) : undefined };
          const s = quoteVideoScript(f, "สมชาย", "F", length, told);
          const keys = s.map((x) => x.key);
          expect(keys[0]).toBe("lead");
          expect(keys[keys.length - 1]).toBe("contact");
          if (length === "short") expect(keys).toEqual(["lead", "price", "contact"]);
          if (length === "long") expect(keys).toEqual(expect.arrayContaining(["story", "qa"]));
          if (length === "max") expect(keys).toEqual(expect.arrayContaining(["story", "versus", "qa", "steps"]));
          for (const x of s) {
            expect(x.voice.trim().length, x.key).toBeGreaterThan(0);
            expect(x.voice, x.key).not.toMatch(/\s{2}/);
            // the new scenes and the brief's lines keep the voice's words (the plan's own lines are the owner's)
            if (["story", "qa", "versus", "steps"].includes(x.key)) expect(x.voice, x.key).not.toMatch(BANNED);
          }
          if (!brief && length !== "short") expect(s[0].voice.startsWith("สวัสดีค่ะ")).toBe(true);
          if (brief?.loop) {
            expect(s[0].voice).not.toMatch(/สวัสดี|สมชาย/);
            expect(s[s.length - 1].voice).not.toMatch(/(ค่ะ|คะ|ครับ)$/);
            expect(s.find((x) => x.key === "price")?.voice).toMatch(/ทักมา/);
          }
        });
      }
    }
  }

  it("keeps today's clip word for word when there is no brief", () => {
    const f = facts(INPUTS[0]);
    const s = quoteVideoScript(f, "สมชาย", "F", "full");
    expect(s.map((x) => x.key)).toEqual(["lead", "price", "cover", "value", "contact"]);
    expect(s[0].voice).toBe("สวัสดีค่ะ คุณสมชาย ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ อายุ 35 ทำทุน 1 ล้าน ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 2 ล้านบาทค่ะ");
    expect(s[4].voice).toBe("คุณสมชายสนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
  });

  it("opens on the hook and the plan's own figures", () => {
    const f = facts(INPUTS[0]);
    const s = quoteVideoScript(f, "สมชาย", "F", "full", { brief: { hook: "question", story: "legacy" } });
    expect(s[0].voice).toBe("คุณสมชาย ถ้าพรุ่งนี้คุณไม่อยู่ ครอบครัวจะมีเงินใช้ต่ออีกกี่ปีคะ แผนนี้ อายุ 35 ทำทุน 1 ล้าน ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 2 ล้านบาทค่ะ");
  });

  it("speaks a man's endings, questions too", () => {
    const f = facts(INPUTS[2]);
    const s = quoteVideoScript(f, "", "M", "max", { brief: { hook: "question", story: "early" } });
    for (const x of s) expect(x.voice, x.key).not.toMatch(/(ค่ะ|คะ)(\s|$)/);
  });
});

describe("lineProblem", () => {
  const f = facts(INPUTS[0]);
  it("lets the quote's figures through, a million said in words too", () => {
    expect(lineProblem("วันละ 79 บาท แลกเงินก้อน 2 ล้านบาท", f, 150)).toBeNull();
    expect(lineProblem("พออายุ 64 ขอคืนได้ 553,000 บาท", f, 150)).toBeNull();
  });
  it("stops a figure the quote does not state, and the voice's banned words", () => {
    expect(lineProblem("วันละ 50 บาท", f, 150)).toMatch(/50/);
    expect(lineProblem("ได้ 3 ล้านบาท", f, 150)).toMatch(/3,000,000/);
    expect(lineProblem("เบี้ยถูกมาก", f, 150)).toMatch(/เบี้ย/);
    expect(lineProblem("ผลตอบแทน 5%", f, 150)).not.toBeNull();
    expect(lineProblem("ได้สองล้านบาท", f, 150)).not.toBeNull();
    expect(lineProblem("มีสวัสดิการแล้ว", f, 150)).toBeNull();
  });
  it("reads figures with their millions", () => {
    expect(numbersIn("1.5 ล้าน และ 2,583 บาท")).toEqual([1_500_000, 1.5, 2583]);
    expect(allowedNumbers(f).has(2_000_000)).toBe(true);
  });
});
