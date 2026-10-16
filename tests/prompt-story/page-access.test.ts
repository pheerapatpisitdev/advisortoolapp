import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_PASS_SETTINGS, type PassState } from "@/lib/members/pass";
import { studioMenu } from "@/lib/shell/menu";

/**
 * คลิปตามโจทย์'s page is open as /studio/story-clip is: agents, and สมาชิกทั่วไป while their pass
 * is live; a signed-out viewer is sent to sign in; an expired member to renew.
 */

const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); }),
}));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const who = vi.hoisted(() => ({ session: true as boolean, agentId: "m1" }));
vi.mock("@/lib/auth/session", () => ({ readSession: async () => (who.session ? { agentId: who.agentId, issuedAt: Date.now() } : null) }));
vi.mock("@/lib/auth/epoch", () => ({ sessionNotBefore: async () => null }));

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: db.from }) }));

const access = vi.hoisted(() => ({ memberAccess: vi.fn() }));
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: access.memberAccess,
}));

const { gatePage } = await import("@/lib/auth/viewer");

const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
const live: PassState = {
  status: "live",
  period: { rowId: 1, kind: "paid", start: new Date("2026-10-12T00:00:00Z"), end: new Date("2026-11-11T00:00:00Z") },
  end: new Date("2026-11-11T00:00:00Z"),
};
const expired: PassState = { status: "expired", end: new Date("2026-10-10T00:00:00Z") };
const memberRow = { id: "m1", email: "m@example.com", name: "สมาชิก", status: "active", revoked_at: null };
const agentRow = {
  id: "a1", agent_code: "123456", name: "ตัวแทน",
  tenant: { id: "t1", slug: "t", name: "T", status: "active", config: null, key_epoch: null },
};

function rowsAre(tables: Record<string, unknown>) {
  db.from.mockImplementation((table: string) => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: tables[table] ?? null, error: null }) };
    return chain;
  });
}
const PAGE = "/studio/prompt-story";

beforeEach(() => {
  vi.clearAllMocks();
  who.session = true;
});

describe("gatePage on /studio/prompt-story", () => {
  it("lets an agent in", async () => {
    who.agentId = "a1";
    rowsAre({ agents: agentRow });
    expect(await gatePage(PAGE)).toMatchObject({ kind: "unitos", agentId: "a1" });
    expect(access.memberAccess).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("lets a สมาชิกทั่วไป with a live pass in", async () => {
    who.agentId = "m1";
    rowsAre({ ins_members: memberRow });
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    expect(await gatePage(PAGE)).toMatchObject({ kind: "member", agentId: "m1" });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("sends a member whose pass has run out to renew", async () => {
    who.agentId = "m1";
    rowsAre({ ins_members: memberRow });
    access.memberAccess.mockResolvedValue({ gated: true, state: expired, settings: on });
    await expect(gatePage(PAGE)).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
  });

  it("keeps a signed-out viewer out, back to sign in with the page to return to", async () => {
    who.session = false;
    rowsAre({});
    await expect(gatePage(PAGE)).rejects.toThrow(`NEXT_REDIRECT /?next=${encodeURIComponent(PAGE)}`);
  });
});

describe("the page and the menu", () => {
  const who2 = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
  const linksOf = (w: typeof who2) => studioMenu(w).flatMap((g) => g.links);

  it("lists คลิปตามโจทย์ right after คลิปเล่าเรื่อง for the owner alone (owner, 2026-10-17)", () => {
    const owner = { ...who2, owner: true };
    const hrefs = linksOf(owner).map((l) => l.href);
    expect(hrefs.indexOf(PAGE)).toBe(hrefs.indexOf("/studio/story-clip") + 1);
    expect(linksOf(owner).find((l) => l.href === PAGE)?.label).toBe("คลิปตามโจทย์");
    for (const w of [who2, { ...who2, admin: true, publish: true, connect: true }]) {
      expect(linksOf(w).map((l) => l.href)).not.toContain(PAGE);
    }
  });

  it("tells anyone else who opens the address that it is closed (owner chose ก, 2026-10-17)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../src/app/studio/prompt-story/page.tsx"), "utf8");
    expect(src).toMatch(/if \(!mayPromptStory\(viewer\)\)/);
    expect(src).toMatch(/PROMPT_STORY_CLOSED/);
  });

  it("keeps the clip's time (the clip is made after the answer, inside the page) and the gate", () => {
    const src = readFileSync(path.resolve(__dirname, "../../src/app/studio/prompt-story/page.tsx"), "utf8");
    expect(src).toMatch(/export const maxDuration = 300;/);
    expect(src).toMatch(/export const dynamic = "force-dynamic";/);
    expect(src).toMatch(/await gatePage\("\/studio\/prompt-story"\)/);
  });
});
