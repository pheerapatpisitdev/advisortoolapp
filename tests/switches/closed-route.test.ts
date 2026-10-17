import { describe, expect, it, vi } from "vitest";

// a tool the Super Admin switched off answers before any drawing, reading or charging
const run = vi.hoisted(() => ({ makeThumbnail: vi.fn(), describePicture: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: async () => null, requireMember: async () => ({ agentId: "a1" }) }));
vi.mock("@/lib/switches/store", () => ({ closedNow: async (key: string) => (key === "thumbnail" || key === "describe" ? "เสียงพากย์ขัดข้อง ปิดชั่วคราว" : null) }));
vi.mock("@/lib/content/thumbnail-run", () => ({ makeThumbnail: run.makeThumbnail }));
vi.mock("@/lib/content/describe-run", () => ({ describePicture: run.describePicture }));

const thumbnail = await import("@/app/api/content-thumbnail/route");
const describeRoute = await import("@/app/api/content-describe/route");

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("a tool switched off (เปิด-ปิดฟังก์ชัน)", () => {
  it("refuses ภาพปกคลิป with the Super Admin's words and draws nothing", async () => {
    const res = await thumbnail.POST(post({ settings: {} }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "เสียงพากย์ขัดข้อง ปิดชั่วคราว" });
    expect(run.makeThumbnail).not.toHaveBeenCalled();
  });

  it("refuses ถอดรูปเป็น prompt and reads nothing", async () => {
    const res = await describeRoute.POST(post({ image: { base64: "AAAA", mimeType: "image/png" } }));
    expect(res.status).toBe(503);
    expect(run.describePicture).not.toHaveBeenCalled();
  });
});
