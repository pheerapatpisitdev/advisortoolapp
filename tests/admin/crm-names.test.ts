import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A lead's name, asked of the service they wrote on. A LINE customer's id went to Facebook's
 * Graph API, which can only refuse it — "Object with ID 'U649…' does not exist" in the logs.
 */

vi.mock("@/lib/facebook/connection", () => ({ pageToken: vi.fn(async () => "fb-token") }));
const { chatLink, forgetProfiles, profileFor } = await import("@/lib/crm/names");

const LINE_USER = "U64903f5906593996f67251ac82585af6";
const fetchMock = vi.fn();

beforeEach(() => {
  forgetProfiles();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-token";
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("a lead's name", () => {
  it("asks LINE for a LINE customer, never Facebook", async () => {
    fetchMock.mockResolvedValue(Response.json({ displayName: "สมหญิง", pictureUrl: "https://profile.line-scdn.net/x" }));
    const p = await profileFor("line", "Udd1c471e55ba7768c0019c4ce93057bb", LINE_USER);
    expect(p).toEqual({ name: "สมหญิง", picture: "https://profile.line-scdn.net/x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://api.line.me/v2/bot/profile/${LINE_USER}`);
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer line-token" });
  });

  it("asks the Page for a Messenger customer", async () => {
    fetchMock.mockResolvedValue(Response.json({ name: "Somchai", profile_pic: "https://fb/x" }));
    const p = await profileFor("messenger", "105", "28346614731664956");
    expect(p?.name).toBe("Somchai");
    expect(String(fetchMock.mock.calls[0][0])).toContain("graph.facebook.com");
  });

  it("does not send a LINE-shaped id to Facebook even when the channel is missing", async () => {
    expect(await profileFor("", "105", LINE_USER)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives no name, and no error, when LINE will not say", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await profileFor("line", null, LINE_USER)).toBeNull();
  });
});

describe("the link to a customer's chat", () => {
  it("opens LINE's own chat for a LINE customer, and the Page's inbox for Messenger", () => {
    expect(chatLink("line", "Udd1", LINE_USER)).toBe("https://chat.line.biz/");
    expect(chatLink("messenger", "105", "123")).toContain("business.facebook.com/latest/inbox/all?asset_id=105");
  });
});
