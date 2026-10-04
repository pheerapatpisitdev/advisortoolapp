import { beforeEach, describe, expect, it } from "vitest";
import { listLeadForms } from "@/lib/ads/lead-forms";
import { tosUrl } from "@/lib/ads/sent-view";

/**
 * Which Instant Forms a Page offers and whether it has accepted Meta's lead-ads terms. Graph is
 * stood in for by a fetch that writes down each request and answers from a queue: what is
 * checked is which token asks what, and what the owner is told.
 */

interface Sent { path: string; query: URLSearchParams; auth: string | null; method: string }
let sent: Sent[];
let replies: { status: number; body: unknown }[];

const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  sent.push({ path: url.pathname, query: url.searchParams, auth: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET" });
  const r = replies.shift();
  if (!r) throw new Error(`unexpected fetch ${url}`);
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const ok = (body: unknown) => ({ status: 200, body });
const PAGE = ok({ id: "111", access_token: "PT", leadgen_tos_accepted: true });

beforeEach(() => {
  sent = [];
  replies = [];
});

describe("listing a Page's lead forms", () => {
  it("asks for the Page token with the user's token, then the forms with the Page's, and keeps only active forms", async () => {
    replies = [PAGE, ok({ data: [{ id: "1", name: "ขอใบเสนอราคา", status: "ACTIVE" }, { id: "2", name: "เก่า", status: "ARCHIVED" }] })];
    const out = await listLeadForms("111", "USER", fetchFn);

    expect(out).toEqual({ ok: true, tosAccepted: true, forms: [{ id: "1", name: "ขอใบเสนอราคา" }] });
    expect(sent.map((s) => s.method)).toEqual(["GET", "GET"]);
    expect(sent[0]).toMatchObject({ path: "/v23.0/111", auth: "Bearer USER" });
    expect(sent[0].query.get("fields")).toBe("access_token,leadgen_tos_accepted");
    expect(sent[1]).toMatchObject({ path: "/v23.0/111/leadgen_forms", auth: "Bearer PT" });
    expect(sent[1].query.get("fields")).toBe("id,name,status");
    expect(sent[1].query.get("limit")).toBe("100");
  });

  it.each([
    ["false", { id: "111", access_token: "PT", leadgen_tos_accepted: false }],
    ["missing", { id: "111", access_token: "PT" }],
  ])("says the terms are not accepted, and lists nothing, when Meta's answer is %s", async (_n, body) => {
    replies = [ok(body)];
    expect(await listLeadForms("111", "USER", fetchFn)).toEqual({ ok: true, tosAccepted: false, forms: [] });
    expect(sent).toHaveLength(1);
  });

  it("answers an empty list for a Page with no active form", async () => {
    replies = [PAGE, ok({ data: [{ id: "2", name: "เก่า", status: "ARCHIVED" }] })];
    expect(await listLeadForms("111", "USER", fetchFn)).toEqual({ ok: true, tosAccepted: true, forms: [] });
  });

  it("says the Page is not one the ads login manages when Meta hands back no Page token", async () => {
    replies = [ok({ id: "111", leadgen_tos_accepted: true })];
    const out = await listLeadForms("111", "USER", fetchFn);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.error).toContain("เพจ");
  });

  it.each([
    ["the Page", [{ status: 400, body: { error: { code: 100, message: "no page" } } }]],
    ["the forms", [PAGE, { status: 400, body: { error: { code: 200, message: "no permission" } } }]],
  ])("passes on Meta's refusal when reading %s", async (_n, r) => {
    replies = [...r];
    const out = await listLeadForms("111", "USER", fetchFn);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.error).toMatch(/^Facebook ไม่รับ/);
  });

  it("asks Meta nothing for a Page id that is not a number", async () => {
    const out = await listLeadForms("1?x", "USER", fetchFn);
    expect(out.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("links to the Page's lead-ads terms", () => {
    expect(tosUrl("111")).toBe("https://www.facebook.com/ads/leadgen/tos?page_id=111");
  });
});
