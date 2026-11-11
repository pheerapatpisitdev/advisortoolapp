import { beforeEach, describe, expect, it, vi } from "vitest";

// the board's list, read from rows given here: no sign-in, no database, no storage
const rows = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock("@/lib/auth/viewer", () => ({
  requireMember: vi.fn(async () => ({ kind: "agent", agentId: "a1", role: "agent", code: "000001", name: "ทดสอบ" })),
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/quote-video/make", async (original) => ({
  ...(await original<typeof import("@/lib/quote-video/make")>()),
  listVideos: vi.fn(async () => rows.list),
  videoLink: vi.fn(async () => null),
}));

const LP = { product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, style: "motion", narrator: "F" } as const;
const row = (id: string, input: object) => ({
  id, input, status: "failed", error: null, customer_name: "", created_at: "2026-11-12T00:00:00Z", video_path: null,
  duration_sec: null, post_text: null, job: null, progress: null,
});

describe("a quote clip's title on the board (owner, 2026-11-11, ก ก ก)", () => {
  beforeEach(() => { rows.list = []; });

  it("names the recipe only where the row is still made with it", async () => {
    const { myVideos } = await import("@/app/studio/quote-video/actions");
    rows.list = [
      row("made", { ...LP, size: "portrait", recipe: "ask" }),
      // a square Motion clip is never a recipe clip, whatever its input holds: titled as one without
      row("square", { ...LP, size: "square", recipe: "ask" }),
      row("plain", { ...LP, size: "square" }),
    ];
    const titles = Object.fromEntries((await myVideos("quote")).map((v) => [v.id, v.title]));
    expect(titles.made).toContain("(Motion · เปิดด้วยคำถาม)");
    expect(titles.square).not.toContain("เปิดด้วยคำถาม");
    expect(titles.square).toBe(titles.plain);
  });
});
