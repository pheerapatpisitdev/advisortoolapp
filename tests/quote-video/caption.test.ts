import { describe, expect, it } from "vitest";
import { captionPieces, captionShown, wordAt } from "@/lib/quote-video/caption";

/** the iShield 10 opening the owner showed (2026-10-20), as the portrait Motion band holds it */
const LINE = "ถ้าคุณเป็นเจ้าของกิจการที่ทุกคนพึ่งพาอยู่ แผน iShield 10 นี้ตอบโจทย์ด้วย 3 จุดเด่น คือ ออมสั้น 10 ปี คุ้มครองรอบด้าน และเงินก้อนคืนตอนอายุ 60 ครับ แผนนี้ คุณผู้ชายอายุ 35 ทำทุน 1 ล้าน คุ้มครองโรคร้ายแรง 70 โรค จ่ายเป็นเงินก้อนตั้งแต่ระยะเริ่มต้นเลยครับ";
const words = LINE.split(" ");
const PORTRAIT = (1080 - 128) / 41;
const text = (p: number[]) => p.map((i) => words[i]).join(" ");

describe("subtitle one short piece at a time", () => {
  const pieces = captionPieces(words, PORTRAIT);

  it("keeps every word once, in order", () => {
    expect(pieces.flat()).toEqual(words.map((_, i) => i));
  });

  it("never runs past the end of a sentence", () => {
    const ends = pieces.map((p) => words[p[p.length - 1]]);
    expect(text(pieces[2])).toBe("คุ้มครองรอบด้าน และเงินก้อนคืนตอนอายุ 60 ครับ");
    expect(ends.filter((w) => w.endsWith("ครับ"))).toHaveLength(2);
    for (const p of pieces) expect(p.slice(0, -1).some((i) => words[i].endsWith("ครับ"))).toBe(false);
  });

  it("keeps a figure with what it counts", () => {
    for (const p of pieces) expect(words[p[p.length - 1]]).not.toMatch(/^[\d,.]+$/);
    expect(pieces.map(text)).toContain("แผนนี้ คุณผู้ชายอายุ 35 ทำทุน 1 ล้าน");
  });

  it("cuts the long line into short pieces", () => {
    expect(pieces.length).toBe(6);
    expect(text(pieces[0])).toBe("ถ้าคุณเป็นเจ้าของกิจการที่ทุกคนพึ่งพาอยู่ แผน iShield");
  });

  it("shows the first piece before the voice and the last once it is done", () => {
    expect(captionShown(words, PORTRAIT, -1)).toEqual(pieces[0]);
    expect(captionShown(words, PORTRAIT, words.length)).toEqual(pieces[pieces.length - 1]);
    expect(captionShown([], PORTRAIT, 0)).toEqual([]);
  });

  it("moves to the next piece as the voice reaches its first word", () => {
    const voiceSec = 16;
    expect(wordAt(words, 0, voiceSec, 0.35)).toBe(-1);
    expect(wordAt(words, 0.36, voiceSec, 0.35)).toBe(0);
    expect(wordAt(words, 99, voiceSec, 0.35)).toBe(words.length - 1);
    const seen = new Set<string>();
    for (let t = 0; t < 17; t += 0.05) seen.add(text(captionShown(words, PORTRAIT, wordAt(words, t, voiceSec, 0.35))));
    expect([...seen]).toEqual(pieces.map(text));
  });

  it("gives a word wider than the band a piece of its own", () => {
    expect(captionPieces(["สั้น", "ก".repeat(80), "ท้าย"], 10)).toEqual([[0], [1], [2]]);
  });
});
