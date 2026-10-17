import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { drawIdea, fallbackPiece, writeIdeas } from "@/lib/collage/ai-pieces";
import { aiPieceScenes, videoPrice } from "@/lib/quote-video/make";
import { aiSpots } from "@/lib/quote-video/themes";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

const LP = { variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000, style: "motion" as const, theme: "collage" as const };
const reply = (text: string) => async () => ({ text }) as never;

describe("คอลลาจ's AI cut-outs (owner chose ข, 2026-10-17)", () => {
  it("draws one for the price, the cover and the contact of a portrait Life Protect clip", () => {
    expect(aiPieceScenes({ ...LP, pieces: "ai" }).map((s) => s.key)).toEqual(["price", "cover", "contact"]);
    expect(aiPieceScenes({ ...LP, pieces: "ai" })[0].voice).toContain("79");
  });

  it("draws none for the library's pictures, another theme, or a clip that is not portrait", () => {
    expect(aiPieceScenes(LP)).toEqual([]);
    expect(aiPieceScenes({ ...LP, pieces: "ai", theme: "paper" })).toEqual([]);
    expect(aiPieceScenes({ ...LP, pieces: "ai", size: "landscape" })).toEqual([]);
  });

  it("leaves the cover out where its drawing fills the page", () => {
    expect(aiSpots(["lead", "price", "cover", "value", "contact"], "rows").map((s) => s.key)).toEqual(["price", "contact"]);
  });

  it("charges one standard picture for each, on top of the clip", () => {
    const plain = videoPrice(LP, DEFAULT_PRICES);
    expect(videoPrice({ ...LP, pieces: "ai" }, DEFAULT_PRICES)).toBe(plain + 3 * DEFAULT_PRICES.drawStandard);
  });

  it("takes AI's ideas, and the library's subject for a scene it gives nothing safe for", async () => {
    const scenes = [{ key: "price" as const, voice: "ออมแค่วันละ 79 บาท" }, { key: "cover" as const, voice: "คุ้มครองถึงอายุ 99" }, { key: "contact" as const, voice: "ทักมาคุยกันได้เลย" }];
    const ideas = await writeIdeas(scenes, { sex: "M", age: 35, plan: "Life Protect" }, reply(JSON.stringify({ scenes: [
      { key: "price", idea: "มือหยอดเหรียญลงกระปุก", subject: "an adult hand dropping a coin into a ceramic piggy bank" },
      { key: "cover", idea: "ป้ายชื่อแบรนด์", subject: "a shop sign with the brand logo" },
    ] })));
    expect(ideas[0]).toEqual({ key: "price", idea: "มือหยอดเหรียญลงกระปุก", subject: "an adult hand dropping a coin into a ceramic piggy bank" });
    expect(ideas[1].idea).toBe("ร่ม");
    expect(ideas[2].idea).toBe("มือถือโทรศัพท์");
    expect(fallbackPiece("cover")).toBe("umbrella");
  });

  it("falls back to the library's subjects when AI cannot be read at all", async () => {
    const ideas = await writeIdeas([{ key: "price", voice: "x" }], { sex: "F", age: 40, plan: "iShield" }, async () => { throw new Error("down"); });
    expect(ideas).toEqual([{ key: "price", idea: "มือถือเหรียญ", subject: expect.stringContaining("gold coins") }]);
  });

  it("tries a drawing twice, then leaves the scene to the library's picture", async () => {
    let calls = 0;
    const idea = { key: "price" as const, idea: "x", subject: "a red apple" };
    expect(await drawIdea(idea, async () => { calls++; throw new Error("busy"); })).toBeNull();
    expect(calls).toBe(2);
    const white = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 20, height: 20, channels: 3, background: "#cc2222" } }).png().toBuffer(), left: 22, top: 22 }]).png().toBuffer();
    const got = await drawIdea(idea, async () => ({ bytes: white, costThb: 0.43 }));
    expect(got?.costThb).toBe(0.43);
    expect((await sharp(got!.png).metadata()).hasAlpha).toBe(true);
  });
});
