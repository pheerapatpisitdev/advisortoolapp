import { describe, expect, it } from "vitest";
import { AD_PAINTERS, adRoundCost, briefPick, painterPick, personPick, pictureRequest, writerPick } from "@/lib/ads/picture-picks";
import { MAX_DIRECTION } from "@/lib/content/background";

const PERSON = "0b9f2c1e-5d3a-4c7b-9e11-2a4f6d8c0b13";

describe("a campaign's ภาพและโมเดล", () => {
  it("keeps only writer ids from the list; อัตโนมัติ and anything else is null", () => {
    expect(writerPick("best")).toBe("best");
    expect(writerPick("cheap")).toBe("cheap");
    for (const v of ["auto", "claude-sonnet-5", "", null, undefined, 3]) expect(writerPick(v)).toBeNull();
  });

  it("offers every painter but ไม่วาดภาพ, and keeps only those", () => {
    expect(AD_PAINTERS.map((p) => p.id)).toEqual(["standard", "sharp", "gemini"]);
    expect(painterPick("gemini")).toBe("gemini");
    for (const v of ["none", "auto", "gpt-image-high", null, {}]) expect(painterPick(v)).toBeNull();
  });

  it("keeps a person by id, with a pose from the list or ให้ AI เลือก", () => {
    expect(personPick({ id: PERSON, pose: "arms" })).toEqual({ id: PERSON, pose: "arms" });
    expect(personPick({ id: PERSON, pose: "dance" })).toEqual({ id: PERSON, pose: "auto" });
    expect(personPick({ id: PERSON })).toEqual({ id: PERSON, pose: "auto" });
    for (const v of [null, "x", { id: "not-a-uuid", pose: "auto" }, { pose: "arms" }]) expect(personPick(v)).toBeNull();
  });

  it("trims the brief, holds it to the drawing's length, and makes empty null", () => {
    expect(briefPick("  ครอบครัวในสวน  ")).toBe("ครอบครัวในสวน");
    expect(briefPick("   ")).toBeNull();
    expect(briefPick(5)).toBeNull();
    expect(briefPick("ก".repeat(MAX_DIRECTION + 10))!.length).toBe(MAX_DIRECTION);
  });

  it("draws to the style, then the brief, and lets the brief give way when long", () => {
    expect(pictureRequest("มินิมอล — พื้นขาว", null)).toBe("มินิมอล — พื้นขาว");
    expect(pictureRequest("มินิมอล", "ไม่เอาโรงพยาบาล")).toBe("มินิมอล\nไม่เอาโรงพยาบาล");
    expect(pictureRequest("", "ไม่เอาโรงพยาบาล")).toBe("ไม่เอาโรงพยาบาล");
    const long = pictureRequest("มินิมอล", "ก".repeat(MAX_DIRECTION));
    expect(long.length).toBe(MAX_DIRECTION);
    expect(long.startsWith("มินิมอล\n")).toBe(true);
  });

  it("prices a round from the picks: อัตโนมัติ as the best writer and มาตรฐาน, a person as Gemini", () => {
    const none = { writer: null, painter: null, person: null };
    // Sonnet 0.61 + overhead 0.03 + GPT Image 0.43 = 1.07 an ad
    expect(adRoundCost(1, none)).toBe("ราว ฿1.1");
    expect(adRoundCost(4, none)).toBe("ราว ฿4.3");
    // Gemini Flash 0.10 + 0.03 + GPT Image HD 0.86 = 0.99
    expect(adRoundCost(2, { writer: "cheap", painter: "sharp", person: null })).toBe("ราว ฿2.0");
    // a person: Gemini Image 2.41 whatever was picked
    expect(adRoundCost(1, { writer: "cheap", painter: "standard", person: { id: PERSON, pose: "auto" } })).toBe("ราว ฿2.5");
  });
});
