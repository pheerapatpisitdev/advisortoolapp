import { describe, expect, it } from "vitest";
import { designEdit, DESIGN_LOOKS, type DesignClip } from "@/lib/shotstack/looks";

const clip = (over: Partial<DesignClip> = {}): DesignClip => ({
  look: "blue", size: "portrait", total: 45, voice: "https://x/voice.wav", voiceAt: 0, music: "https://x/music.mp3",
  fonts: { regular: "https://x/r.ttf", semibold: "https://x/s.ttf" },
  parts: [
    { kind: "cover", start: 0, length: 2.5, title: "เมื่อคำว่าแข็งแรงไม่พอ", kicker: "เรื่องจริงจากลูกค้า" },
    { kind: "scene", start: 2.5, length: 7.7, picture: "https://x/pic-0.png", text: "วางแผนการเงินเพื่อครอบครัวและค่ารักษา" },
    { kind: "scene", start: 10.2, length: 8, picture: null, text: "เบี้ยปีละ 28,700 บาท" },
    { kind: "contact", start: 42, length: 3, greeting: "ทักมาคุยกันได้นะคะ", name: "คุณเอ", reach: "LINE @abc" },
  ],
  ...over,
});

type Track = { clips: { asset: { type: string; text?: string; src?: string }; start: number; length: number; effect?: string }[] };
const tracks = (c: DesignClip) => (designEdit(c).timeline as { tracks: Track[] }).tracks;
const texts = (c: DesignClip) => tracks(c).flatMap((t) => t.clips).filter((x) => x.asset.type === "rich-text").map((x) => x.asset.text);

describe("designEdit", () => {
  it("breaks the scene's Thai words into lines itself", () => {
    expect(texts(clip())).toContain("วางแผนการเงินเพื่อ\nครอบครัวและค่ารักษา");
  });

  it("lays the narration once from 0 to the end, and loops the music under it", () => {
    const audio = tracks(clip()).flatMap((t) => t.clips).filter((x) => x.asset.type === "audio");
    expect(audio.filter((a) => a.asset.src === "https://x/voice.wav")).toEqual([expect.objectContaining({ start: 0, length: 45 })]);
    const music = audio.filter((a) => a.asset.src === "https://x/music.mp3");
    expect(music.map((m) => [m.start, m.length])).toEqual([[0, 20], [20, 20], [40, 5]]);
  });

  it("moves each picture, in turn, and leaves a scene without one on the ground", () => {
    const pics = tracks(clip()).flatMap((t) => t.clips).filter((x) => x.asset.type === "image");
    expect(pics).toHaveLength(1);
    expect(pics[0].effect).toBe("zoomInSlow");
  });

  it("puts the agent's name and reach on the closing card", () => {
    expect(texts(clip())).toContain("ทักมาคุยกันได้นะคะ");
    expect(texts(clip())).toContain("คุณเอ · LINE @abc");
  });

  it("keeps a figure card's own lines, one per line", () => {
    const parts = [{ kind: "scene" as const, start: 0, length: 5, picture: null, text: "", lines: ["ชาย 35 ปี · ทุน 1 ล้าน", "เบี้ยปีละ 28,700 บาท"] }];
    expect(texts(clip({ parts }))).toContain("ชาย 35 ปี · ทุน 1 ล้าน\nเบี้ยปีละ 28,700 บาท");
  });

  it("starts the narration after the cover", () => {
    const voice = tracks(clip({ voiceAt: 2.5 })).flatMap((t) => t.clips).find((x) => x.asset.src === "https://x/voice.wav");
    expect(voice).toMatchObject({ start: 2.5, length: 42.5 });
  });

  it("gives the film look its two black bars and no band", () => {
    const shapes = tracks(clip({ look: "film" })).flatMap((t) => t.clips).filter((x) => x.asset.type === "shape");
    expect(shapes).toHaveLength(2);
  });

  it("sizes the output by the clip's shape", () => {
    expect(designEdit(clip({ size: "landscape" })).output).toMatchObject({ size: { width: 1920, height: 1080 } });
    expect(designEdit(clip({ size: "square" })).output).toMatchObject({ size: { width: 1080, height: 1080 } });
  });

  it("names three looks", () => {
    expect(DESIGN_LOOKS.map((l) => l.name)).toEqual(["แถบน้ำเงิน", "ทองอบอุ่น", "ภาพยนตร์"]);
  });
});
