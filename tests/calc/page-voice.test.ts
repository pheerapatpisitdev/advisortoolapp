import { describe, expect, it } from "vitest";
import { spokenBy, voiceOf } from "@/lib/assistant/voice";
import { CHOICES } from "@/lib/assistant/choose";

const LUCKY = "105982528649026";
const TALK = "1431905706931225";
const WORKING = "103716981993581";

describe("the voice a Page answers in", () => {
  it("is the same for every Page: no particle at all", () => {
    expect(voiceOf(LUCKY)).toBe("neutral");
    expect(voiceOf(TALK)).toBe("neutral");
    expect(voiceOf(WORKING)).toBe("neutral");
  });

  /** A Page connected tomorrow speaks like the ones that are, not like nothing. */
  it("gives a Page it has never seen the same voice", () => {
    expect(voiceOf("999999999")).toBe("neutral");
    expect(voiceOf(undefined)).toBe("neutral");
  });

  it("leaves the copy alone for the Page it was written for", () => {
    expect(spokenBy("male", CHOICES)).toBe(CHOICES);
  });

  /** คะ ends a question and ค่ะ ends a statement; writing ค่ะ on both is the visible mistake. */
  it("ends a question with คะ and a statement with ค่ะ", () => {
    expect(spokenBy("female", "สนใจแบบไหนครับ")).toBe("สนใจแบบไหนคะ");
    expect(spokenBy("female", "มีแบบนี้ไหมครับ")).toBe("มีแบบนี้ไหมคะ");
    expect(spokenBy("female", "ขออภัยครับ")).toBe("ขออภัยค่ะ");
    expect(spokenBy("female", "รอสักครู่นะครับ")).toBe("รอสักครู่นะคะ");
    expect(spokenBy("female", "ยินดีครับผม")).toBe("ยินดีค่ะ");
  });

  it("says เรา where the copy says ผม", () => {
    expect(spokenBy("female", "ผมคิดให้ได้เฉพาะแบบนี้ครับ")).toBe("เราคิดให้ได้เฉพาะแบบนี้ค่ะ");
  });

  /**
   * Hair, not a pronoun. Critical illness is three of the arrangements sold here, and what a
   * customer asks after chemotherapy is exactly this word.
   */
  it("does not rewrite the hair on somebody's head", () => {
    expect(spokenBy("female", "ผมร่วงเคลมได้ไหมครับ")).toBe("ผมร่วงเคลมได้ไหมคะ");
    expect(spokenBy("female", "เส้นผมไม่เกี่ยวครับ")).toBe("เส้นผมไม่เกี่ยวค่ะ");
  });

  describe("without the particle", () => {
    it("takes ครับ, ค่ะ and คะ off the end of a line", () => {
      expect(spokenBy("neutral", "สนใจแบบไหนครับ")).toBe("สนใจแบบไหน");
      expect(spokenBy("neutral", "ขออภัยค่ะ")).toBe("ขออภัย");
      expect(spokenBy("neutral", "มีแบบนี้ไหมคะ")).toBe("มีแบบนี้ไหม");
      expect(spokenBy("neutral", "ยินดีครับผม")).toBe("ยินดี");
      expect(spokenBy("neutral", "รอสักครู่นะครับ")).toBe("รอสักครู่นะ");
    });

    it("leaves no stray space where the particle was", () => {
      expect(spokenBy("neutral", "ขอบคุณครับ 🙏 เดี๋ยวแอดมินเช็กให้ครับ\nต่อไปครับ")).toBe("ขอบคุณ 🙏 เดี๋ยวแอดมินเช็กให้\nต่อไป");
    });

    it("keeps คะแนน, which is a score and not a particle", () => {
      expect(spokenBy("neutral", "คะแนนสะสมครับ")).toBe("คะแนนสะสม");
    });

    it("says เรา where the copy says ผม, and leaves the hair alone", () => {
      expect(spokenBy("neutral", "ผมคิดให้ครับ")).toBe("เราคิดให้");
      expect(spokenBy("neutral", "ผมร่วงเคลมได้ไหมครับ")).toBe("ผมร่วงเคลมได้ไหม");
    });
  });

  it("turns the whole menu over without leaving a ครับ behind", () => {
    const said = spokenBy("female", CHOICES);
    expect(said).not.toContain("ครับ");
    expect(said).toContain("สวัสดีค่ะ");
    const bare = spokenBy("neutral", CHOICES);
    expect(bare).not.toMatch(/ครับ|ค่ะ/);
    expect(bare).toContain("สวัสดี");
  });
});
