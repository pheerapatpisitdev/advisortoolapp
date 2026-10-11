import { describe, expect, it, vi } from "vitest";

/** รูปที่บอทส่ง (/admin/teach, owner 2026-10-11): what may be saved as a Page's intro pictures. */

const saved: { scope: string; pictures: string[] }[] = [];
const PREFIX = "https://x.supabase.co/storage/v1/object/public/page-welcome/";

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("@/lib/chat/page-welcome-store", () => ({ bucketPrefix: () => PREFIX }));
vi.mock("@/lib/facebook/connection", () => ({
  pageConnections: async () => [{ pageId: "105982528649026", pageName: "LuckyPlanner", scopes: [], fields: [], connectedAt: "" }],
}));
vi.mock("@/lib/chat/intro-store", async (orig) => ({
  ...(await orig<typeof import("@/lib/chat/intro-store")>()),
  saveIntroPictures: async (scope: string, pictures: string[]) => { saved.push({ scope, pictures }); },
  resetIntroPictures: async () => undefined,
}));

const { saveIntro, resetIntro } = await import("@/app/admin/teach/intro-actions");
const { INTRO_PICTURE } = await import("@/lib/assistant/intro");

describe("saving intro pictures", () => {
  it("keeps uploads and the built-in picture, for every Page or a connected one", async () => {
    saved.length = 0;
    expect(await saveIntro("*", [INTRO_PICTURE, `${PREFIX}a1.jpg`])).toEqual({ ok: true });
    expect(await saveIntro("105982528649026", [])).toEqual({ ok: true });
    expect(saved).toEqual([{ scope: "*", pictures: [INTRO_PICTURE, `${PREFIX}a1.jpg`] }, { scope: "105982528649026", pictures: [] }]);
  });

  it("refuses a picture from anywhere else, more than three, or an unknown Page", async () => {
    expect((await saveIntro("*", ["https://evil.example/x.jpg"])).ok).toBe(false);
    expect((await saveIntro("*", [`${PREFIX}a.jpg`, `${PREFIX}b.jpg`, `${PREFIX}c.jpg`, `${PREFIX}d.jpg`])).ok).toBe(false);
    expect(await saveIntro("999", [])).toEqual({ ok: false, error: "ไม่พบเพจนี้" });
    expect((await resetIntro("999")).ok).toBe(false);
  });
});
