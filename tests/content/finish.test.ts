import { describe, expect, it } from "vitest";
import {
  FINISH_HOOK_RULES, MAX_LOOPS, finishRules, parseLoops, readShareWhy, withFinish,
} from "@/lib/content/finish";
import type { ContentOutput } from "@/lib/content/output";

/** สูตรอ่าน-ดูจนจบ: the owner's two guides as rules for the writers (finish.ts). */

const out = (over: Partial<ContentOutput> = {}): ContentOutput => ({
  hooks: ["หัว"], body: "เนื้อ", closing: "ปิด", hashtags: [], imagePrompt: "", disclaimer: "", ...over,
});

describe("the hook rules", () => {
  it("open from what the reader half knows, keep Facebook's rule, and ask for a reason to share", () => {
    expect(FINISH_HOOK_RULES).toContain("รู้อยู่แล้วครึ่งหนึ่ง");
    expect(FINISH_HOOK_RULES).toContain("บุคคลที่สาม");
    expect(FINISH_HOOK_RULES).toContain("ไม่เกิน 80 ตัวอักษร");
    for (const k of ["use", "insider", "voice"]) expect(FINISH_HOOK_RULES).toContain(`${k} =`);
  });
});

describe("the writer's rules", () => {
  it("give a post the fold, the four-line paragraph and the loops to report", () => {
    const r = finishRules("post");
    expect(r).toContain("ดูเพิ่มเติม");
    expect(r).toContain("4 บรรทัด");
    expect(r).toContain('"loops"');
    expect(r).not.toContain("โครงเวลา");
  });

  it("give each clip length its own timing, and every figure said on screen", () => {
    expect(finishRules("script", "30")).toContain("ภายใน 8 วิ");
    expect(finishRules("script", "60")).toContain("วินาที 15 และ 30");
    expect(finishRules("script", "180")).toContain("ทุกราว 30 วินาที");
    expect(finishRules("script", "60")).toContain("{จอ: …}");
  });

  it("leave a looped clip's ending to the loop rules", () => {
    expect(finishRules("script", "60", true)).toContain("กฎการปิดท้ายของคลิปวนลูปมาก่อน");
    expect(finishRules("script", "60", false)).not.toContain("คลิปวนลูป");
  });

  it("ask a writer that writes its own hook for the reason to share, and a planned one not", () => {
    expect(finishRules("post", null, false, true)).toContain('"shareWhy"');
    expect(finishRules("post")).not.toContain('"shareWhy"');
  });

  it("carry none of สูตรคอนเทนต์โปร's own rules", () => {
    for (const r of [finishRules("post"), finishRules("script", "60")]) {
      for (const w of ["Hook Stacking", "B-roll", "Mid-CTA", "สูตรคอนเทนต์โปร"]) expect(r).not.toContain(w);
    }
  });

  it("write an ad as before", () => {
    expect(finishRules("ad")).toBe("");
  });
});

describe("the reason to share", () => {
  it("is one of three, or nothing", () => {
    expect(readShareWhy("use")).toBe("use");
    expect(readShareWhy("voice")).toBe("voice");
    for (const v of ["fear", "", null, undefined, 1]) expect(readShareWhy(v)).toBeNull();
  });
});

describe("the loops a writer reports", () => {
  const text = "มี 3 จุดที่คนข้าม ข้อสุดท้ายเจอบ่อยสุด\nจุดแรกคือค่าห้อง\nข้อสุดท้ายคือค่าผ่าตัด";

  it("keep a loop whose words are there, opened before it is closed", () => {
    expect(parseLoops([{ open: "ข้อสุดท้ายเจอบ่อยสุด", close: "ข้อสุดท้ายคือค่าผ่าตัด" }], text))
      .toEqual([{ open: "ข้อสุดท้ายเจอบ่อยสุด", close: "ข้อสุดท้ายคือค่าผ่าตัด" }]);
  });

  it("drop one quoting words the piece does not have, closed before opened, or not a pair", () => {
    expect(parseLoops([{ open: "ไม่มีในนี้", close: "ข้อสุดท้ายคือค่าผ่าตัด" }], text)).toEqual([]);
    expect(parseLoops([{ open: "ข้อสุดท้ายคือค่าผ่าตัด", close: "มี 3 จุด" }], text)).toEqual([]);
    expect(parseLoops([{ open: "มี 3 จุด" }, "x", null], text)).toEqual([]);
    expect(parseLoops("not a list", text)).toEqual([]);
  });

  it(`keep at most ${MAX_LOOPS}`, () => {
    const many = Array.from({ length: 8 }, () => ({ open: "มี 3 จุด", close: "ค่าผ่าตัด" }));
    expect(parseLoops(many, text)).toHaveLength(MAX_LOOPS);
  });
});

describe("a piece marked as written to the guides", () => {
  const piece = out({ hooks: ["เดี๋ยวบอกข้อที่พลาดบ่อย"], body: "จุดแรกคือค่าห้อง\nข้อที่พลาดบ่อยคือค่าผ่าตัด" });
  const loops = [{ open: "เดี๋ยวบอกข้อที่พลาดบ่อย", close: "ข้อที่พลาดบ่อยคือค่าผ่าตัด" }];

  it("takes the loops and the reason from a one-piece reply", () => {
    const reply = JSON.stringify({ hook: "x", body: "y", loops, shareWhy: "insider" });
    expect(withFinish(piece, reply)).toMatchObject({ formula: "finish", shareWhy: "insider", loops });
  });

  it("reads a planned writer's {pieces:[…]}, and keeps the planner's reason over the writer's", () => {
    const reply = JSON.stringify({ pieces: [{ body: "y", loops, shareWhy: "voice" }] });
    expect(withFinish(piece, reply, "use")).toMatchObject({ formula: "finish", shareWhy: "use", loops });
  });

  it("still marks a piece whose reply had neither, or could not be read", () => {
    for (const reply of ["{}", "ขอโทษครับ"]) {
      const got = withFinish(piece, reply);
      expect(got.formula).toBe("finish");
      expect(got.loops).toBeUndefined();
      expect(got.shareWhy).toBeUndefined();
    }
  });
});
