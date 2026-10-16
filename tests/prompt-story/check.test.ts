import { describe, expect, it } from "vitest";
import { allowedFor, checkScene, checkScript } from "@/lib/prompt-story/check";
import type { PromptScene } from "@/lib/prompt-story/types";
import type { StoryFigure } from "@/lib/quote-video/story";

const scene = (o: Partial<PromptScene> = {}): PromptScene => ({ voice: "วันนี้มาคุยกัน", screen: "เริ่มวางแผน", picture: "ผู้ชายนั่งคิด", ...o });
const figure = { plan: "LIFEPROTECT", variant: "x", sex: "M", age: 40, sumAssured: 3_000_000, annual: 99_999, monthly: 8_400 } as unknown as StoryFigure;

describe("prompt-story script checker", () => {
  it("fails a number that is neither in the brief nor the figure, naming it", () => {
    const r = checkScene(scene({ voice: "ปีละ 99,999 บาท" }), allowedFor("ลูกค้าอายุ 40"));
    expect(r.join(" ")).toContain("99999");
  });
  it("passes the same line when the figure's annual is 99,999", () => {
    expect(checkScene(scene({ voice: "ปีละ 99,999 บาท" }), allowedFor("ลูกค้าอายุ 40", figure))).toEqual([]);
  });
  it("accepts the figure's sum said in millions and its age, month", () => {
    const a = allowedFor("", figure);
    expect(checkScene(scene({ voice: "ทุน 3 ล้าน อายุ 40 เดือนละ 8,400" }), a)).toEqual([]);
  });
  it("fails promises", () => {
    const a = allowedFor("");
    expect(checkScene(scene({ voice: "รับประกันผลตอบแทน" }), a).length).toBeGreaterThan(0);
    expect(checkScene(scene({ voice: "การันตี" }), a).length).toBeGreaterThan(0);
  });
  it("fails a promise of no health check, in any field, spaced or not", () => {
    const a = allowedFor("");
    for (const t of ["สมัครง่าย ไม่ต้องตรวจสุขภาพ", "ไม่ต้อง ตรวจ สุขภาพ เลย", "ไม่ตรวจสุขภาพ"]) {
      expect(checkScene(scene({ voice: t }), a).join(" ")).toMatch(/ตรวจสุขภาพ/);
      expect(checkScene(scene({ screen: t }), a).join(" ")).toMatch(/ตรวจสุขภาพ/);
    }
    // the title and the caption go through the same check (createPromptStory, writer)
    expect(checkScene({ voice: "", screen: "ไม่ต้องตรวจสุขภาพ", picture: "" }, a)).not.toEqual([]);
    expect(checkScene({ voice: "แผนนี้ไม่ต้องตรวจสุขภาพ", screen: "", picture: "" }, a)).not.toEqual([]);
  });
  it("fails naming another insurer, in any field", () => {
    const a = allowedFor("");
    for (const t of ["ดีกว่าเมืองไทยประกันชีวิต", "ถูกกว่า AIA", "เทียบกับ prudential", "อลิอันซ์", "FWD ไม่มีแบบนี้", "กรุงเทพประกันชีวิต"]) {
      expect(checkScene(scene({ voice: t }), a).join(" ")).toMatch(/บริษัท/);
      expect(checkScene(scene({ screen: t }), a).join(" ")).toMatch(/บริษัท/);
      expect(checkScene({ voice: t, screen: "", picture: "" }, a)).not.toEqual([]);
    }
  });
  it("leaves ordinary words alone", () => {
    expect(checkScene(scene({ voice: "ตรวจสุขภาพประจำปีกันด้วยนะ ประกันชีวิตไทยทุกคนควรมี" }), allowedFor(""))).toEqual([]);
  });
  it("passes a scene with no numbers", () => {
    expect(checkScene(scene(), allowedFor(""))).toEqual([]);
  });
  it("checks screen and picture too", () => {
    const a = allowedFor("");
    expect(checkScene(scene({ screen: "ปีละ 777 บาท" }), a).length).toBeGreaterThan(0);
    expect(checkScene(scene({ picture: "ป้าย 888" }), a).length).toBeGreaterThan(0);
  });
  it("rejects any digit in a picture note, even an allowed number", () => {
    const a = allowedFor("ลูกค้าอายุ 40", figure);
    expect(checkScene(scene({ picture: "ป้ายอายุ 40" }), a).join(" ")).toContain("picture");
    expect(checkScene(scene({ picture: "ภาพเลข 3,000,000" }), a).length).toBeGreaterThan(0);
    expect(checkScene(scene({ picture: "ป้าย ๔๐" }), a).length).toBeGreaterThan(0);
    expect(checkScene(scene({ voice: "อายุ 40", screen: "อายุ 40" }), a)).toEqual([]);
  });
  it("checkScript lists only failing scenes, numbered from 0", () => {
    const out = checkScript([scene(), scene({ voice: "การันตี" })], "", undefined);
    expect(out.map((o) => o.scene)).toEqual([1]);
    expect(out[0].reasons.length).toBeGreaterThan(0);
  });
  it("holds a scene's move to the same rules: no digits, no promises, no other insurer", () => {
    const a = allowedFor("ลูกค้าอายุ 40", figure);
    expect(checkScene(scene({ move: "sign shows 40" }), a).join(" ")).toContain("move");
    expect(checkScene(scene({ move: "guarantee" }), a)).toEqual([]);
    expect(checkScene(scene({ move: "The mother smiles and the child waves" }), a)).toEqual([]);
  });
});
