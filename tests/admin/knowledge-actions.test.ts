import { describe, expect, it, vi } from "vitest";

/**
 * The knowledge page's deletes and switch used to swallow a failure and return nothing, and
 * the page removed the row anyway — a refused delete looked done. They answer {ok, error} now.
 */

let fail = false;

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/content/store", () => ({
  addWord: async () => undefined,
  listWords: async () => [],
  deleteWord: async () => { if (fail) throw new Error("permission denied"); },
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    const q = {
      delete: () => q,
      update: () => q,
      eq: async () => ({ error: fail ? { message: "permission denied" } : null }),
    };
    return { from: () => q };
  },
}));

const { deleteNote, setNoteEnabled, removeContentWord } = await import("@/app/admin/knowledge/actions");

describe("knowledge actions", () => {
  it("say ok when the database agrees", async () => {
    fail = false;
    await expect(deleteNote("1")).resolves.toEqual({ ok: true });
    await expect(setNoteEnabled("1", false)).resolves.toEqual({ ok: true });
    await expect(removeContentWord("ดีที่สุด")).resolves.toEqual({ ok: true });
  });

  it("say what went wrong, in Thai, when it does not", async () => {
    fail = true;
    for (const r of [await deleteNote("1"), await setNoteEnabled("1", true), await removeContentWord("ดีที่สุด")]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/ไม่สำเร็จ/);
    }
    fail = false;
  });
});
