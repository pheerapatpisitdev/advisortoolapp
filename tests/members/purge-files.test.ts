import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = vi.hoisted(() => ({ removed: [] as { bucket: string; paths: string[] }[] }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    storage: {
      from: (bucket: string) => ({
        list: async () => ({ data: [], error: null }),
        remove: async (paths: string[]) => { mem.removed.push({ bucket, paths }); return { error: null }; },
      }),
    },
  }),
}));

import { clearMemberFiles } from "@/lib/members/purge-files";

beforeEach(() => { mem.removed.length = 0; });

describe("clearMemberFiles", () => {
  const none = { pieces: [], people: [], videos: [], logos: [], library: [] };
  it("clears the logos and the library uploads from content-media", async () => {
    await clearMemberFiles("m1", { ...none, logos: ["logos/a.png"], library: ["library/u1.png", "library/u2.jpg"] });
    expect(mem.removed).toContainEqual({ bucket: "content-media", paths: ["logos/a.png"] });
    expect(mem.removed).toContainEqual({ bucket: "content-media", paths: ["library/u1.png", "library/u2.jpg"] });
  });
  it("asks Storage for nothing when there are none", async () => {
    await clearMemberFiles("m1", none);
    expect(mem.removed).toEqual([]);
  });
});
