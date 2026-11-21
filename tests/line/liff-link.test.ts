import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* เชื่อม LINE inside LINE (owner chose ง, 2026-11-21): the LIFF id, LINE's token check, and the
 * endpoint the LIFF page calls. The code check and the table are stand-ins: their own tests
 * cover them (tests/auth, tests/line/agent-line.test.ts). */

const checkAgentCode = vi.fn();
const counted = vi.fn(async (_ip: string, check: (left: number) => Promise<unknown>) => check(5));
vi.mock("@/lib/auth/code-check", () => ({ BROKEN: "ระบบขัดข้อง ลองใหม่อีกครั้ง", checkAgentCode, counted }));

const linkAgentLine = vi.fn(async () => {});
const agentOfLinkCode = vi.fn(async () => null as string | null);
const lineIsLinked = vi.fn(async () => false);
vi.mock("@/lib/line/agent-line", () => ({ OA_ID: "@006crkvq", linkAgentLine, agentOfLinkCode, lineIsLinked }));

const liff = await import("@/lib/line/liff");
const { POST } = await import("@/app/api/line/link/route");

const LIFF = "2001234567-AbCdEfGh";
const fetchMock = vi.fn();
const lineSays = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
const post = (body: unknown) => POST(new Request("https://www.advisortool.app/api/line/link", {
  method: "POST", body: JSON.stringify(body), headers: { "x-real-ip": "1.2.3.4" },
}) as never);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("LINE_LIFF_ID", LIFF);
  for (const f of [checkAgentCode, linkAgentLine, agentOfLinkCode, lineIsLinked, fetchMock]) f.mockReset();
  lineIsLinked.mockResolvedValue(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the LIFF id", () => {
  it("is read from LINE_LIFF_ID, and its channel is the part before the dash", () => {
    expect(liff.liffId()).toBe(LIFF);
    expect(liff.loginChannelOf(LIFF)).toBe("2001234567");
    expect(liff.liffUrl(LIFF)).toBe(`https://liff.line.me/${LIFF}`);
    expect(liff.liffUrl(LIFF, "123456")).toBe(`https://liff.line.me/${LIFF}?lt=123456`);
  });

  it("an unset or malformed id means not set up", () => {
    vi.stubEnv("LINE_LIFF_ID", "");
    expect(liff.liffId()).toBeNull();
    vi.stubEnv("LINE_LIFF_ID", "not-an-id!");
    expect(liff.liffId()).toBeNull();
  });
});

describe("LINE's token check", () => {
  it("asks LINE with this channel, and takes the person's id from LINE's answer", async () => {
    lineSays(200, { sub: "Uabc", name: "Boy", aud: "2001234567" });
    expect(await liff.verifyIdToken("tok", "2001234567")).toEqual({ userId: "Uabc", name: "Boy" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.line.me/oauth2/v2.1/verify");
    expect(String(init.body)).toBe("id_token=tok&client_id=2001234567");
  });

  it("a token LINE refuses, or one for another channel, is nobody", async () => {
    lineSays(400, { error: "invalid_request" });
    expect(await liff.verifyIdToken("tok", "2001234567")).toBeNull();
    lineSays(200, { sub: "Uabc", aud: "999" });
    expect(await liff.verifyIdToken("tok", "2001234567")).toBeNull();
    expect(await liff.verifyIdToken("", "2001234567")).toBeNull();
  });
});

describe("POST /api/line/link", () => {
  it("not set up: says so and asks LINE nothing", async () => {
    vi.stubEnv("LINE_LIFF_ID", "");
    const res = await post({ idToken: "tok", code: "123456" });
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a token LINE refuses links nothing", async () => {
    lineSays(400, {});
    const res = await post({ idToken: "forged", code: "123456" });
    expect(res.status).toBe(401);
    expect(checkAgentCode).not.toHaveBeenCalled();
    expect(linkAgentLine).not.toHaveBeenCalled();
  });

  it("with only the token, says whether this LINE is already linked", async () => {
    lineSays(200, { sub: "Uabc", aud: "2001234567" });
    lineIsLinked.mockResolvedValueOnce(true);
    expect(await (await post({ idToken: "tok" })).json()).toEqual({ ok: true, linked: true });
  });

  it("a right agent code links LINE's own id for that person, never one the page sent", async () => {
    lineSays(200, { sub: "Uabc", aud: "2001234567" });
    checkAgentCode.mockResolvedValueOnce({ ok: true, value: { agentId: "agent-1", name: "สมชาย ใจดี" } });
    const res = await post({ idToken: "tok", code: "123456", userId: "Uattacker" });
    expect(await res.json()).toEqual({ ok: true, linked: true, name: "สมชาย ใจดี", oa: "@006crkvq" });
    expect(checkAgentCode).toHaveBeenCalledWith("123456", "1.2.3.4", { demo: false });
    expect(linkAgentLine).toHaveBeenCalledWith("agent-1", "Uabc");
  });

  it("a wrong code says why and links nothing", async () => {
    lineSays(200, { sub: "Uabc", aud: "2001234567" });
    checkAgentCode.mockResolvedValueOnce({ ok: false, error: "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้ เหลืออีก 4 ครั้ง" });
    const res = await post({ idToken: "tok", code: "000000" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/เหลืออีก 4 ครั้ง/);
    expect(linkAgentLine).not.toHaveBeenCalled();
  });

  it("a member's one-time link is counted like a code, and links that member", async () => {
    lineSays(200, { sub: "Uabc", aud: "2001234567" });
    agentOfLinkCode.mockResolvedValueOnce("member-1");
    expect((await post({ idToken: "tok", lt: "654321" })).status).toBe(200);
    expect(counted).toHaveBeenCalled();
    expect(linkAgentLine).toHaveBeenCalledWith("member-1", "Uabc");

    lineSays(200, { sub: "Uabc", aud: "2001234567" });
    const res = await post({ idToken: "tok", lt: "111111" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/หมดเวลา/);
    expect(linkAgentLine).toHaveBeenCalledTimes(1);
  });
});
