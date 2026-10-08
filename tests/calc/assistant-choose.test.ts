import { describe, expect, it } from "vitest";
import { CHOOSE_HEALTH, CHOOSE_LIFE, productByTopic, productNamedIn } from "@/lib/assistant/choose";

describe("a message that names a plan", () => {
  it("recognises the health one", () => {
    for (const said of ["สนใจประกันสุขภาพค่ะ", "ไอเฮลท์ตี้ อัลตร้า ราคาเท่าไหร่", "iHealthy Ultra"]) {
      expect(productNamedIn(said)).toBe("ihealthy");
    }
  });

  it("recognises the life one", () => {
    for (const said of ["Life Protect x 2", "ไลฟ์โพรเทค", "ประกันชีวิต", "มรดกเบี้ยไม่ทิ้ง"]) {
      expect(productNamedIn(said)).toBe("lifeprotect");
    }
  });

  it("recognises the legacy arrangement", () => {
    for (const said of ["มรดกเบี้ยทิ้ง", "มรดกเพื่อครอบครัว", "มรดก+โรคร้ายแรง", "เบี้ยทิ้ง"]) {
      expect(productNamedIn(said)).toBe("legacy");
    }
  });

  /**
   * An m.me link carries a plan's English name and nothing else.
   *
   * `?ref=legacy` arrives as the whole of the customer's first message, and a ref the reader
   * does not know fails the way silent failures do — the customer taps a link that says which
   * plan they came for and is asked which plan they came for. Three of the four already
   * answered to their own name; this one did not, which made it the only one that could be
   * linked to and not arrive.
   */
  it("answers to the English name a link would carry", () => {
    expect(productNamedIn("lifeprotect")).toBe("lifeprotect");
    expect(productNamedIn("ihealthy")).toBe("ihealthy");
    expect(productNamedIn("ishield")).toBe("ishield");
    expect(productNamedIn("legacy")).toBe("legacy");
  });

  /**
   * The two arrangements are told apart by one word, and it is a word of negation.
   *
   * "เบี้ยไม่ทิ้ง" holds "ทิ้ง" inside it, so a reader written a shade loosely sends every
   * customer who taps the first button into the second one's brain — quietly, for as long as
   * nobody reads the inbox. This is the test that fails the day someone writes /ทิ้ง/.
   */
  it("does not read เบี้ยไม่ทิ้ง as เบี้ยทิ้ง", () => {
    expect(productNamedIn("มรดกเบี้ยไม่ทิ้ง")).toBe("lifeprotect");
    expect(productNamedIn("อยากได้แบบเบี้ยไม่ทิ้งครับ")).toBe("lifeprotect");
    expect(productNamedIn("เบี้ยทิ้งก็ได้")).toBe("legacy");
  });

  /**
   * A bare "มรดก" used to mean the life plan, because it was the only thing sold under that
   * word. It now names three arrangements, so it names none of them: the customer is shown
   * the buttons rather than guessed at.
   */
  it("asks rather than guessing when a customer says only มรดก", () => {
    expect(productNamedIn("สนใจประกันมรดกครับ")).toBeUndefined();
  });

  it("recognises the two buttons it offers", () => {
    expect(productNamedIn(CHOOSE_HEALTH)).toBe("ihealthy");
    expect(productNamedIn(CHOOSE_LIFE)).toBe("lifeprotect");
  });

  it("names nothing when a message names both", () => {
    expect(productNamedIn("ประกันสุขภาพกับประกันชีวิต ต่างกันยังไง")).toBeUndefined();
  });

  it("names nothing when a message names neither", () => {
    for (const said of ["สนใจค่ะ", "สวัสดีครับ", "หญิง 35", "เท่าไหร่"]) {
      expect(productNamedIn(said)).toBeUndefined();
    }
  });
});

describe("a message that names no plan but says what it is about", () => {
  it("hears the health topics", () => {
    for (const said of ["ค่ารักษาเท่าไหร่", "ค่าห้องวันละเท่าไหร่", "เหมาจ่ายไหม", "OPD ได้ไหม", "แอดมิทเบิกได้ไหม"]) {
      expect(productByTopic(said)).toBe("ihealthy");
    }
  });

  it("hears the life ones", () => {
    for (const said of ["ทุน 1 ล้าน เท่าไหร่", "ขอทุน 5 แสน", "จ่าย 19 ปี", "เวนคืนได้เท่าไหร่"]) {
      expect(productByTopic(said)).toBe("lifeprotect");
    }
  });

  it("hears a critical-illness ad button as iShield, whatever the sum is written like", () => {
    for (const said of ["ประกันโรคร้ายแรง 1,000,000", "ประกันโรคร้ายแรง 1 ล้าน", "ประกันโรคร้ายแรง", "อยากได้ประกันโรคร้าย"]) {
      expect(productByTopic(said)).toBe("ishield");
    }
  });

  it("leaves CI 123 and cancer to their own doors", () => {
    for (const said of ["CI123 โรคร้ายแรง จ่ายตอนไหน", "ประกันโรคร้ายแรง มะเร็ง"]) {
      expect(productByTopic(said)).not.toBe("ishield");
    }
  });

  it("does not mistake a health declaration for a health plan", () => {
    // someone buying life cover is asked to declare, and asks about it
    for (const said of ["ต้องตรวจสุขภาพไหม", "แถลงสุขภาพยังไง", "สุขภาพไม่ดีทำได้ไหม"]) {
      expect(productByTopic(said)).toBeUndefined();
      expect(productNamedIn(said)).toBeUndefined();
    }
  });

  it("says nothing about a greeting", () => {
    for (const said of ["สนใจค่ะ", "สวัสดีครับ", "หญิง 35"]) {
      expect(productByTopic(said)).toBeUndefined();
    }
  });
});
