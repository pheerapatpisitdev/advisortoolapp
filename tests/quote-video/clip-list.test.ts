import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VideoItem } from "@/app/studio/quote-video/actions";

/**
 * The clip shelf as it first draws (owner, 2026-11-27, chose 1ก ข). The suite has no DOM, so this is the
 * first frame only: which tab is open, what the tabs count, and the words on an empty shelf. Every action is
 * mocked: nothing here reaches the database.
 */
vi.mock("@/app/studio/quote-video/actions", () => ({
  myVideos: vi.fn(), myClipDays: vi.fn(async () => []), removeVideo: vi.fn(), addToCalendar: vi.fn(), calendarCaption: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));
const { ClipList } = await import("@/app/studio/quote-video/ClipList");

const clip = (id: string, status: VideoItem["status"], title = `คลิป ${id}`): VideoItem => ({
  id, status, title, createdAt: "2026-11-26T07:00:00Z", error: null, watch: status === "done" ? "https://x/v.mp4" : null,
  save: status === "done" ? "https://x/v.mp4?dl" : null, share: status === "done" ? "https://x/s" : null, fileName: "v.mp4",
  paid: null, named: false, personal: false, size: "portrait", voiceFull: false,
});
const draw = (items: VideoItem[] | null) =>
  renderToStaticMarkup(createElement(ClipList, { board: "quote", items, setItems: () => undefined, pages: [] }));
const text = (html: string) => html.replace(/<[^>]+>/g, "");
const openTab = (html: string) => text(html.match(/<button[^>]*aria-selected="true"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? "").trim();

describe("clip shelf, first frame", () => {
  it("has three tabs and no ทั้งหมด", () => {
    const html = draw([clip("a", "done")]);
    expect(text(html)).not.toContain("ทั้งหมด");
    expect([...html.matchAll(/role="tab"/g)]).toHaveLength(3);
  });

  it("opens on กำลังสร้าง while a clip is being made, showing only that clip", () => {
    const html = draw([clip("a", "done", "Life Protect · ชาย 35"), clip("b", "rendering", "iHealthy · หญิง 42")]);
    expect(openTab(html)).toBe("กำลังสร้าง 1");
    expect(text(html)).toContain("iHealthy · หญิง 42");
    expect(text(html)).not.toContain("Life Protect · ชาย 35");
  });

  it("opens on เสร็จ when nothing is being made", () => {
    const html = draw([clip("a", "done", "Life Protect · ชาย 35"), clip("b", "failed")]);
    expect(openTab(html)).toBe("เสร็จ 1");
    expect(text(html)).toContain("Life Protect · ชาย 35");
  });

  it("tells a first-time agent how clips get here", () => {
    expect(text(draw([]))).toContain("ยังไม่มีวิดีโอ — เลือกในเครื่องมือแล้วกด “สร้างวิดีโอ” คลิปจะขึ้นตรงนี้");
  });

  it("has the search box, การ์ด / รายการ and the day buttons", () => {
    const t = text(draw([clip("a", "done")]));
    for (const w of ["การ์ด", "รายการ", "วันนี้", "7 วัน", "30 วัน", "ทุกวัน"]) expect(t).toContain(w);
    expect(draw([clip("a", "done")])).toContain('placeholder="ค้นชื่อลูกค้า หรือแผน"');
  });
});
