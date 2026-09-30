import { describe, it, expect } from "vitest";
import { agentFilter, maySee, maySeePiece, pieceFilter, type Scope } from "@/lib/auth/scope";

const member: Scope = { agents: ["a1"], unowned: false, pages: [], owner: { agentId: "a1", tenantId: "t1" } };
const staff: Scope = { agents: ["s1", "s2"], unowned: true, pages: ["p1", "p2"], owner: { agentId: "s1", tenantId: "t1" } };
const all: Scope = { agents: null, unowned: true, pages: null, owner: null };
const none: Scope = { agents: [], unowned: false, pages: [], owner: null };

describe("scope", () => {
  it("shows an agent their own pieces and nobody else's", () => {
    expect(maySee(member, "a1")).toBe(true);
    expect(maySee(member, "a2")).toBe(false);
    expect(maySee(member, null)).toBe(false);
  });

  it("shows staff the staff's pieces and the unowned ones", () => {
    expect(maySee(staff, "s2")).toBe(true);
    expect(maySee(staff, null)).toBe(true);
    expect(maySee(staff, "a1")).toBe(false);
  });

  it("shows work with no request everything, and a request from nobody nothing", () => {
    expect(maySee(all, "anyone")).toBe(true);
    expect(maySee(none, "anyone")).toBe(false);
    expect(maySee(none, null)).toBe(false);
  });

  it("writes the same rules as filters", () => {
    expect(agentFilter(member)).toBe("agent_id.in.(a1)");
    expect(agentFilter(staff)).toBe("agent_id.in.(s1,s2),agent_id.is.null");
    expect(agentFilter(all)).toBeNull();
    expect(agentFilter(none)).toBe("agent_id.eq.00000000-0000-0000-0000-000000000000");
  });
});

describe("a piece and its Page (owner, 2026-09-30)", () => {
  it("is seen by whoever looks after its Page, whoever wrote it", () => {
    expect(maySeePiece(staff, { agentId: "s2", pageId: "p1" })).toBe(true);
    expect(maySeePiece(staff, { agentId: "a9", pageId: "p2" })).toBe(true);
    expect(maySeePiece({ ...staff, pages: ["p1"] }, { agentId: "s1", pageId: "p2" })).toBe(false);
  });

  it("on no Page, is seen as before", () => {
    expect(maySeePiece(staff, { agentId: "s2", pageId: null })).toBe(true);
    expect(maySeePiece(member, { agentId: "a1", pageId: null })).toBe(true);
    expect(maySeePiece(member, { agentId: "a2", pageId: null })).toBe(false);
  });

  it("is seen by work with no request, and never by nobody", () => {
    expect(maySeePiece(all, { agentId: null, pageId: "p9" })).toBe(true);
    expect(maySeePiece(none, { agentId: "a1", pageId: "p1" })).toBe(false);
  });

  it("writes the same rule as one filter", () => {
    expect(pieceFilter(staff)).toBe("page_id.in.(p1,p2),and(page_id.is.null,or(agent_id.in.(s1,s2),agent_id.is.null))");
    expect(pieceFilter(member)).toBe("and(page_id.is.null,or(agent_id.in.(a1)))");
    expect(pieceFilter(all)).toBeNull();
    expect(pieceFilter(none)).toBe("and(page_id.is.null,or(agent_id.eq.00000000-0000-0000-0000-000000000000))");
  });
});
