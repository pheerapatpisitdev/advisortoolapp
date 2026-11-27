import { describe, expect, it } from "vitest";
import { spokenBy } from "@/lib/quote-video/script";

/** a man's voice ends his sentences with ครับ wherever a woman's line ends one (owner, 2026-10-11; R12, 2026-11-22) */
describe("spokenBy", () => {
  it("leaves a woman's line as written", () => {
    expect(spokenBy("ทักมาได้เลยนะคะ", "F")).toBe("ทักมาได้เลยนะคะ");
  });

  it("turns every ending for a man, before a space or at the end", () => {
    expect(spokenBy("สวัสดีค่ะ วันนี้มีอะไรใหม่คะ", "M")).toBe("สวัสดีครับ วันนี้มีอะไรใหม่ครับ");
    expect(spokenBy("ทักมาได้เลยนะคะ", "M")).toBe("ทักมาได้เลยนะครับ");
  });

  it("turns an ending that punctuation follows", () => {
    expect(spokenBy("รู้ไหมคะ?", "M")).toBe("รู้ไหมครับ?");
    expect(spokenBy("ทักมาเลยนะคะ!", "M")).toBe("ทักมาเลยนะครับ!");
    expect(spokenBy("จริงไหมคะ! ลองดูค่ะ.", "M")).toBe("จริงไหมครับ! ลองดูครับ.");
    expect(spokenBy("แบบนี้คะ, หรือแบบนั้นคะ…", "M")).toBe("แบบนี้ครับ, หรือแบบนั้นครับ…");
  });

  it("keeps คะ inside a word", () => {
    expect(spokenBy("ได้คะแนนเต็มค่ะ", "M")).toBe("ได้คะแนนเต็มครับ");
  });
});
