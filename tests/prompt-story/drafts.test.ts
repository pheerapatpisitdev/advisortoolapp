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
// a สมาชิกทั่วไป writes scripts only while their pass is live, as they make clips (make.ts createVideo)
const pass = vi.hoisted(() => ({ open: true, unreadable: false }));
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: async () => { if (pass.unreadable) throw new Error("down"); return { gated: true }; },
  passOpen: () => pass.open,
}));
import { PASS_EXPIRED, PASS_UNREADABLE } from "@/lib/members/access";

import { writePromptStory } from "@/app/studio/prompt-story/actions";

const OK = { ok: true, title: "t", caption: "c", scenes: [{ voice: "v", screen: "s", picture: "p" }], notes: [] };

beforeEach(() => { hourCount = 0; saved.length = 0; pass.open = true; pass.unreadable = false; written.mockReset(); written.mockResolvedValue(OK); });

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
  it("passes an off-topic refusal through, kept as a refused draft so it counts toward the hour", async () => {
    written.mockResolvedValue({ ok: false, refusal: "ไม่เกี่ยวกับประกัน" });
    expect(await writePromptStory({ brief: "สูตรต้มยำ", scenes: 3 })).toEqual({ ok: false, error: "ไม่เกี่ยวกับประกัน" });
    expect(saved).toHaveLength(1);
    expect(saved[0][2]).toEqual({ refused: true, refusal: "ไม่เกี่ยวกับประกัน" });
  });
  it("refused briefs count toward the 20", async () => {
    written.mockResolvedValue({ ok: false, refusal: "ไม่เกี่ยวกับประกัน" });
    for (let i = 0; i < 20; i++) {
      await writePromptStory({ brief: `เรื่องอื่น ${i}`, scenes: 3 });
      hourCount = saved.length;
    }
    expect(written).toHaveBeenCalledTimes(20);
    const r = await writePromptStory({ brief: "อีกเรื่อง", scenes: 3 });
    expect(r.ok).toBe(false);
    expect(written).toHaveBeenCalledTimes(20);
  });
  it("refuses a member whose pass has run out, or cannot be read, before any model call", async () => {
    pass.open = false;
    expect(await writePromptStory({ brief: "ชวนวางแผน", scenes: 3 })).toEqual({ ok: false, error: PASS_EXPIRED });
    pass.open = true;
    pass.unreadable = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await writePromptStory({ brief: "ชวนวางแผน", scenes: 3 })).toEqual({ ok: false, error: PASS_UNREADABLE });
    expect(written).not.toHaveBeenCalled();
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
  it("member delete takes the drafts too, the live function otherwise unchanged", () => {
    const sql = readFileSync("supabase/migrations/20261113_prompt_drafts.sql", "utf8");
    const live = readFileSync("supabase/migrations/20261104_member_delete.sql", "utf8");
    const fn = (s: string) => s.slice(s.indexOf("create or replace function public.ins_member_delete"), s.indexOf("$$;", s.indexOf("create or replace function public.ins_member_delete")) + 3);
    const mine = fn(sql);
    expect(mine).toMatch(/delete from ins_prompt_drafts where agent_id = p_member;/);
    // every line of the live body is still there, in order
    const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("--"));
    const left = lines(mine).filter((l) => !/ins_prompt_drafts/.test(l));
    expect(left).toEqual(lines(fn(live)));
    // before the member row itself goes
    expect(mine.indexOf("ins_prompt_drafts")).toBeLessThan(mine.indexOf("delete from ins_members"));
    expect(sql).toMatch(/grant execute on function public\.ins_member_delete\(uuid\) to service_role/);
  });
});
