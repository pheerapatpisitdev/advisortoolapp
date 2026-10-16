import { describe, expect, it } from "vitest";
import { promptStoryCaption } from "@/lib/prompt-story/caption";
import { boardOf } from "@/lib/quote-video/board";
import { paidLine } from "@/lib/quote-video/paid-line";
import { buildHistory, type HistSources } from "@/lib/home/history";
import { buildDrafts } from "@/lib/admin/people-history";
import type { PromptStoryInput } from "@/lib/prompt-story/types";

const base: PromptStoryInput = {
  product: "FREESTORY", brief: "ชวนคุยเรื่องออมเงิน", title: "ออมวันนี้", caption: "ออมนิดๆ วันนี้ สบายใจวันหน้า\n#ประกันชีวิต",
  scenes: [{ voice: "สวัสดีค่ะ", screen: "ออม", picture: "คนยิ้ม" }], style: "cartoon", painter: "standard", faces: { narrator: "x" },
};
const figure = { plan: "LIFEPROTECT", variant: "WLF19H", sex: "M", age: 35, sumAssured: 1_000_000, annual: 20000, monthly: 1700 } as const;

describe("promptStoryCaption", () => {
  it("is the written caption, without the figure line when there is no figure", () => {
    const c = promptStoryCaption(base);
    expect(c).toBe(base.caption);
    expect(c).not.toContain("*เบี้ย");
  });
  it("adds the example-premium line with the plan name when a figure was used", () => {
    const c = promptStoryCaption({ ...base, figure: { ...figure } });
    expect(c).toContain("*เบี้ยในคลิปเป็นตัวอย่างจาก Life Protect เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท");
    expect(c.startsWith(base.caption)).toBe(true);
  });
  it("never carries a customer's name, even if one rides on the input", () => {
    const c = promptStoryCaption({ ...base, customer_name: "สมชาย" } as PromptStoryInput);
    expect(c).not.toContain("สมชาย");
  });
});

describe("boards", () => {
  it("keeps คลิปตามโจทย์ only on its own board", () => {
    expect(boardOf({ product: "FREESTORY" })).toBe("prompt");
    expect(boardOf({ product: "STORY" })).toBe("story");
    expect(boardOf({ product: "LIFEPROTECT" })).toBe("quote");
    expect(boardOf({})).toBe("quote");
  });
});

describe("paid line", () => {
  const v = (o: object) => ({ status: "done", paid_by: "free", held_satang: null, charged_satang: null, ...o }) as Parameters<typeof paidLine>[0];
  it("a plain free clip says free right", () => expect(paidLine(v({}))).toBe("ใช้สิทธิ์ฟรี"));
  it("a free clip whose pictures were charged does not say only free", () => {
    const l = paidLine(v({ held_satang: 1500, charged_satang: 1500 }))!;
    expect(l).toContain("สิทธิ์ฟรี");
    expect(l).toContain("ภาพ");
    expect(l).toContain("หักจากกระเป๋า");
  });
  it("a free clip with pictures still held says the money is set aside", () => {
    expect(paidLine(v({ held_satang: 1500 }))).toContain("กันเงิน");
  });
  it("a failed free clip gives both back", () => expect(paidLine(v({ status: "failed", held_satang: 1500 }))).toBe("คืนสิทธิ์ฟรีและเงินแล้ว"));
});

describe("history", () => {
  const empty: HistSources = { pieces: [], posts: [], videos: [], customers: [], thumbnails: [], readings: [], sends: [], entries: [] };
  it("links a FREESTORY row to /studio/prompt-story and shows the shortened brief", () => {
    const [h] = buildHistory({ ...empty, videos: [{ id: "v1", createdAt: "2026-10-16T03:00:00Z", product: "FREESTORY", fhc: false, motion: false, customer: "", status: "done", brief: "ก".repeat(120) }] });
    expect(h.href).toBe("/studio/prompt-story");
    expect(h.title).toContain("คลิปตามโจทย์");
    expect(h.title).toContain("ก".repeat(20));
    expect(h.title.length).toBeLessThan(90);
  });
  it("leaves the other clips' links as they were", () => {
    const hs = buildHistory({ ...empty, videos: [
      { id: "a", createdAt: "2026-10-16T03:00:00Z", product: "STORY", fhc: false, motion: false, customer: "", status: "done" },
      { id: "b", createdAt: "2026-10-16T02:00:00Z", product: "LIFEPROTECT", fhc: false, motion: false, customer: "", status: "done" },
    ] });
    expect(hs.map((h) => h.href)).toEqual(["/studio/story-clip", "/studio/quote-video"]);
  });
});

describe("Super Admin drafts", () => {
  it("lists a draft with its brief for the person", () => {
    const [d] = buildDrafts([{ id: "d1", at: "2026-10-16T03:00:00Z", by: "a1", brief: { brief: "ชวนออมเงิน", scenes: 3 }, madeClipId: null }]);
    expect(d.by).toBe("a1");
    expect(d.title).toContain("บท");
    expect(d.text).toBe("ชวนออมเงิน");
    expect(d.note).toContain("ยังไม่ได้ทำคลิป");
  });
  it("says when the draft became a clip", () => {
    const [d] = buildDrafts([{ id: "d1", at: "2026-10-16T03:00:00Z", by: "a1", brief: { brief: "x" }, madeClipId: "c1" }]);
    expect(d.note).toContain("ทำเป็นคลิปแล้ว");
  });
});
