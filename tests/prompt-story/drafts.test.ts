import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

let hourCount = 0;
const saved: unknown[][] = [];
const written = vi.fn();
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => ({ agentId: "agent-1" }) }));
vi.mock("@/lib/prompt-story/drafts", () => ({
  draftsLastHour: async () => hourCount,
  saveDraft: async (...a: unknown[]) => { saved.push(a); return "draft-1"; },
}));
vi.mock("@/lib/prompt-story/writer", () => ({ writeStory: (...a: unknown[]) => written(...a) }));

import { writePromptStory } from "@/app/studio/prompt-story/actions";

const OK = { ok: true, title: "t", caption: "c", scenes: [{ voice: "v", screen: "s", picture: "p" }], notes: [] };

beforeEach(() => { hourCount = 0; saved.length = 0; written.mockReset(); written.mockResolvedValue(OK); });

describe("writePromptStory", () => {
  it("refuses the 21st script in an hour, in Thai, without writing", async () => {
    hourCount = 20;
    const r = await writePromptStory({ brief: "ชวนวางแผน", scenes: 3 });
    expect(r.ok).toBe(false);
    expect(!r.ok && /[ก-๙]/.test(r.error)).toBe(true);
    expect(written).not.toHaveBeenCalled();
  });
  it("allows the 20th", async () => {
    hourCount = 19;
    expect((await writePromptStory({ brief: "ชวนวางแผน", scenes: 3 })).ok).toBe(true);
  });
  it("refuses 601 characters and an empty brief", async () => {
    expect((await writePromptStory({ brief: "ก".repeat(601), scenes: 3 })).ok).toBe(false);
    expect((await writePromptStory({ brief: "   ", scenes: 3 })).ok).toBe(false);
    expect((await writePromptStory({ brief: "ก".repeat(600), scenes: 3 })).ok).toBe(true);
    expect(written).toHaveBeenCalledTimes(1);
  });
  it("refuses a bad figure", async () => {
    const r = await writePromptStory({ brief: "x", scenes: 3, figure: { plan: "nope" } });
    expect(r.ok).toBe(false);
    expect(written).not.toHaveBeenCalled();
  });
  it("passes an off-topic refusal through and saves nothing", async () => {
    written.mockResolvedValue({ ok: false, refusal: "ไม่เกี่ยวกับประกัน" });
    expect(await writePromptStory({ brief: "สูตรต้มยำ", scenes: 3 })).toEqual({ ok: false, error: "ไม่เกี่ยวกับประกัน" });
    expect(saved).toHaveLength(0);
  });
  it("returns the scenes and the saved draft id", async () => {
    const r = await writePromptStory({ brief: "ชวนวางแผน", scenes: 5 });
    expect(r).toEqual({ ok: true, id: "draft-1", title: "t", caption: "c", scenes: OK.scenes, notes: [] });
    expect(saved[0][0]).toBe("agent-1");
  });
});

describe("migration", () => {
  it("is service-role only", () => {
    const sql = readFileSync("supabase/migrations/20261113_prompt_drafts.sql", "utf8");
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.ins_prompt_drafts from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy/);
    // the clip a draft was made into: the one claim that stops a second press
    expect(sql).toMatch(/made_clip_id uuid/);
  });
});
