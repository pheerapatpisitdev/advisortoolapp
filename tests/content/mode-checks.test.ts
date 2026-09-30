import { describe, expect, it, vi } from "vitest";
import { strayNumbers } from "@/lib/content/check";
import { modeChecks } from "@/lib/content/mode-checks";
import { knowledgeMessages, subjectOf } from "@/lib/content/knowledge";
import { draftMessages } from "@/lib/content/draft";

/** The checks each plan-less mode needs, applied at writing and again at every edit (final review, 2026-09-29). */

describe("every figure, when there is nothing to find one in", () => {
  it("flags a small count too, where the ordinary check lets it pass", () => {
    expect(strayNumbers("ระยะรอคอย 30 วัน", "")).toEqual([]);
    expect(strayNumbers("ระยะรอคอย 30 วัน", "", { every: true })).not.toEqual([]);
  });

  it("still leaves a script's time markers alone", () => {
    expect(strayNumbers("[3–15 วิ] พูดต่อ", "", { every: true })).toEqual([]);
  });
});

describe("which checks a mode takes", () => {
  it("reads ความรู้ strictly: every figure", () => {
    expect(modeChecks("knowledge", undefined)).toEqual({ recruit: false, every: true });
  });

  it("reads a recruiting draft with หาทีม's rules, and any other draft without them", () => {
    expect(modeChecks("draft", "ชวนมาร่วมทีมตัวแทน รายได้ดี").recruit).toBe(true);
    expect(modeChecks("draft", "รับสมัครตัวแทนประกันชีวิต").recruit).toBe(true);
    expect(modeChecks("draft", "ทุนประกันชีวิต 1 ล้านพอไหม").recruit).toBe(false);
  });

  it("keeps หาทีม's own, and a plan's none", () => {
    expect(modeChecks("recruit", undefined)).toEqual({ recruit: true, every: false });
    expect(modeChecks("/lifeprotect", undefined)).toEqual({ recruit: false, every: false });
  });
});

describe("the briefs the review asked for", () => {
  it("asks for a quote short enough that the poster never cuts it", () => {
    const text = knowledgeMessages(subjectOf("quote", "family", "")!, 0, "", "post", null, false, null).map((m) => String(m.content)).join("\n");
    expect(text).toContain("ไม่เกิน 60 ตัวอักษร");
    expect(text).not.toContain("ไม่เกิน 80 ตัวอักษร");
  });

  it("tells the polisher a recruiting draft gets no income figure and picks no one by age or sex", () => {
    const text = draftMessages("ชวนมาร่วมทีม", 0, "", "post", null, false, null).map((m) => String(m.content)).join("\n");
    expect(text).toContain("ห้ามใส่ตัวเลขรายได้");
  });
});

vi.mock("@/lib/content/one-call-run", () => ({ oneCallRound: vi.fn(async (r: unknown) => ({ ok: true, items: [], costThb: 0, missing: 0, r })) }));

describe("the rounds pass their checks to the runner", () => {
  it("ความรู้: an empty yardstick, every figure", async () => {
    const { writeKnowledge } = await import("@/lib/content/knowledge-run");
    const { oneCallRound } = await import("@/lib/content/one-call-run");
    await writeKnowledge({ kind: "article", subject: "waiting", count: 1 }, null);
    expect(vi.mocked(oneCallRound).mock.calls.at(-1)![0]).toMatchObject({ yardstick: "", checks: { every: true, recruit: false } });
  });

  it("เขียนเอง: the draft as yardstick, and หาทีม's rules when it recruits", async () => {
    const { writeDraft } = await import("@/lib/content/draft-run");
    const { oneCallRound } = await import("@/lib/content/one-call-run");
    await writeDraft({ draft: "ชวนมาร่วมทีม รายได้ 50,000 บาทต่อเดือน", count: 1 }, null);
    expect(vi.mocked(oneCallRound).mock.calls.at(-1)![0]).toMatchObject({ yardstick: "ชวนมาร่วมทีม รายได้ 50,000 บาทต่อเดือน", checks: { recruit: true, every: false } });
  });
});
