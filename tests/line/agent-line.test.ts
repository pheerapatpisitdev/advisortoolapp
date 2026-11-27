import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* An in-memory stand-in for the two tables the link touches: enough of supabase-js's chain for
 * select/update/upsert with eq filters, maybeSingle and a plain await. */
const db: Record<string, Record<string, unknown>[]> = {};
function from(name: string) {
  const rows = (db[name] ??= []);
  let patch: Record<string, unknown> | null = null;
  const filters: [string, unknown][] = [];
  const hit = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    limit: () => q,
    update: (p: Record<string, unknown>) => { patch = p; return q; },
    upsert: (row: Record<string, unknown>) => {
      const clash = row.link_code != null && rows.some((r) => r.link_code === row.link_code && r.agent_id !== row.agent_id);
      if (clash) return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
      const at = rows.find((r) => r.agent_id === row.agent_id);
      if (at) Object.assign(at, row);
      else rows.push({ notify_clip_done: true, notify_clip_failed: true, notify_money_low: false, money_low_sent: false, line_user_id: null, linked_at: null, link_code: null, link_expires: null, ...row });
      return Promise.resolve({ error: null });
    },
    maybeSingle: () => {
      const found = hit();
      if (patch) for (const r of found) Object.assign(r, patch);
      return Promise.resolve({ data: found[0] ? { ...found[0] } : null, error: null });
    },
    then: (ok: (v: unknown) => void) => {
      if (patch) for (const r of hit()) Object.assign(r, patch);
      ok({ data: hit().map((r) => ({ ...r })), error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from }) }));

const reply = vi.fn(async () => {});
const push = vi.fn(async () => {});
const isFriend = vi.fn(async () => true as boolean | null);
const friendProfile = vi.fn(async () => ({ displayName: "Boy" }) as { displayName: string } | null | undefined);
const richMenuIdOfAlias = vi.fn(async () => "richmenu-calc" as string | null);
const linkRichMenu = vi.fn(async () => {});
const unlinkRichMenu = vi.fn(async () => {});
vi.mock("@/lib/line/client", () => ({ reply, push, isFriend, friendProfile, richMenuIdOfAlias, linkRichMenu, unlinkRichMenu }));

const line = await import("@/lib/line/agent-line");
const { tryLink } = await import("@/lib/line/owner-alert");
const { lineViewOf } = await import("@/lib/line/link-view");

const AGENT = "11111111-1111-1111-1111-111111111111";
const said = () => (reply.mock.calls.at(-1) as unknown as [string, { text: string }[]] | undefined)?.[1][0].text ?? "";

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  reply.mockClear();
  push.mockClear();
  isFriend.mockReset().mockResolvedValue(true);
  richMenuIdOfAlias.mockReset().mockResolvedValue("richmenu-calc");
  linkRichMenu.mockReset().mockResolvedValue(undefined);
  unlinkRichMenu.mockReset().mockResolvedValue(undefined);
});

/** Whose menu (owner chose ข ก, 2026-11-24): a linked LINE sees the agents' menu, everybody else the customers'. */
describe("the menu under a linked agent's chat", () => {
  it("becomes the agents' menu when the LINE page links them, found by its alias", async () => {
    await line.linkAgentLine(AGENT, "Uagent");
    expect(richMenuIdOfAlias).toHaveBeenCalledWith("advisor-calc");
    expect(linkRichMenu).toHaveBeenCalledWith("Uagent", "richmenu-calc");
    expect(unlinkRichMenu).not.toHaveBeenCalled();
  });

  it("becomes the agents' menu when a typed code links them, and the reply says so", async () => {
    const { code } = await line.startAgentLink(AGENT);
    expect(await line.tryAgentLink(code, "Uagent", "r")).toBe(true);
    expect(linkRichMenu).toHaveBeenCalledWith("Uagent", "richmenu-calc");
    expect(said()).toContain("เมนูด้านล่างเปลี่ยนเป็นเมนูตัวแทนแล้ว");
  });

  it("goes back to the customers' menu when they unlink", async () => {
    await line.linkAgentLine(AGENT, "Uagent");
    await line.unlinkAgent(AGENT);
    expect(unlinkRichMenu).toHaveBeenCalledWith("Uagent");
  });

  it("leaves the LINE they linked before with the customers' menu", async () => {
    await line.linkAgentLine(AGENT, "Uold");
    await line.linkAgentLine(AGENT, "Unew");
    expect(unlinkRichMenu).toHaveBeenCalledWith("Uold");
    expect(linkRichMenu).toHaveBeenLastCalledWith("Unew", "richmenu-calc");
  });

  it("still links when LINE refuses the menu, or there is no agents' menu yet", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    linkRichMenu.mockRejectedValueOnce(new Error("LINE 500"));
    await expect(line.linkAgentLine(AGENT, "Uagent")).resolves.toBeUndefined();
    expect((await line.agentLine(AGENT)).linked).toBe(true);
    richMenuIdOfAlias.mockResolvedValueOnce(null);
    linkRichMenu.mockClear();
    await line.linkAgentLine(AGENT, "Uagent");
    expect(linkRichMenu).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("the agent's code", () => {
  it("is six digits, good for ten minutes, and its QR opens the account's chat with the words typed", async () => {
    const { code, until } = await line.startAgentLink(AGENT);
    expect(code).toMatch(/^\d{6}$/);
    expect(Date.parse(until) - Date.now()).toBeGreaterThan(9 * 60_000);
    const v = lineViewOf(await line.agentLine(AGENT));
    expect(v.linked).toBe(false);
    expect(v.pending?.words).toBe(`ผูก ${code}`);
    expect(v.pending?.url).toBe(`https://line.me/R/oaMessage/%40006crkvq/?${encodeURIComponent(`ผูก ${code}`)}`);
  });

  it("a fresh code replaces the last one", async () => {
    const a = await line.startAgentLink(AGENT);
    const b = await line.startAgentLink(AGENT);
    expect((await line.agentLine(AGENT)).pendingCode).toBe(b.code);
    if (a.code !== b.code) expect(await line.tryAgentLink(a.code, "Uagent", "r")).toBe(false);
  });

  it("an expired code is not shown and does not link", async () => {
    const { code } = await line.startAgentLink(AGENT);
    db.ins_agent_line[0].link_expires = new Date(Date.now() - 1000).toISOString();
    expect((await line.agentLine(AGENT)).pendingCode).toBeNull();
    expect(await line.tryAgentLink(code, "Uagent", "r")).toBe(false);
  });
});

describe("the chat taking the code (owner-alert.tryLink)", () => {
  it("links the agent when it is not the owner's code, and the reply says so", async () => {
    const { code } = await line.startAgentLink(AGENT);
    expect(await tryLink(`ผูก ${code}`, "Uagent", "tok")).toBe(true);
    const v = await line.agentLine(AGENT);
    expect(v.linked).toBe(true);
    expect(v.pendingCode).toBeNull();
    expect(db.ins_agent_line[0].line_user_id).toBe("Uagent");
    expect(said()).toContain("เชื่อม LINE นี้กับบัญชี advisortool ของคุณแล้ว");
    expect(said()).not.toContain("เพิ่มเพื่อน");
  });

  it("asks a chat that is not a friend yet to add the account", async () => {
    isFriend.mockResolvedValue(false);
    const { code } = await line.startAgentLink(AGENT);
    await tryLink(`ผูก ${code}`, "Uagent", "tok");
    expect(said()).toContain("กดเพิ่มเพื่อน");
    expect(said()).toContain("https://line.me/R/ti/p/%40006crkvq");
  });

  it("a wrong code is answered as wrong, and links no one", async () => {
    await line.startAgentLink(AGENT);
    expect(await tryLink("ผูก 999999", "Ux", "tok")).toBe(true);
    expect(said()).toContain("รหัสไม่ถูกหรือหมดเวลา");
    expect((await line.agentLine(AGENT)).linked).toBe(false);
  });

  it("an ordinary message is left to the bot", async () => {
    expect(await tryLink("ชาย 35 1000000", "Ux", "tok")).toBe(false);
    expect(reply).not.toHaveBeenCalled();
  });
});

describe("the alerts", () => {
  async function linked(): Promise<void> {
    const { code } = await line.startAgentLink(AGENT);
    await line.tryAgentLink(code, "Uagent", "tok");
    push.mockClear();
  }

  it("a clip done goes to the agent's LINE with its name and its board", async () => {
    await linked();
    expect(await line.tellAgentClipDone(AGENT, { product: "LIFEPROTECT" }, "วิดีโอนำเสนอ · Life Protect", "สมชาย")).toBe(true);
    const [to, [msg]] = push.mock.calls[0] as unknown as [string, { text: string }[]];
    expect(to).toBe("Uagent");
    expect(msg.text.split("\n")).toEqual(["🎬 คลิปทำเสร็จแล้ว", "วิดีโอนำเสนอ · Life Protect · คุณสมชาย", "", expect.stringMatching(/^ดูคลิป https?:\/\/.+\/studio\/quote-video$/)]);
  });

  it("a clip done with its file sends the clip itself: words, the video, the board, in one push", async () => {
    await linked();
    const video = { url: "https://x.supabase.co/storage/v1/object/sign/quote-video/abc/quote.mp4?token=t", preview: "https://www.advisortool.app/api/line/clip-preview/abc" };
    expect(await line.tellAgentClipDone(AGENT, { product: "LIFEPROTECT" }, "วิดีโอนำเสนอ · Life Protect", "สมชาย", video)).toBe(true);
    expect(push).toHaveBeenCalledTimes(1);
    const [to, msgs] = push.mock.calls[0] as unknown as [string, Record<string, string>[]];
    expect(to).toBe("Uagent");
    expect(msgs).toHaveLength(3);
    expect(msgs[0].text.split("\n")).toEqual(["🎬 คลิปทำเสร็จแล้ว", "วิดีโอนำเสนอ · Life Protect · คุณสมชาย", "กดค้างที่คลิป → แชร์ เพื่อส่งต่อให้ลูกค้าได้เลย"]);
    expect(msgs[1]).toEqual({ type: "video", originalContentUrl: video.url, previewImageUrl: video.preview });
    expect(msgs[2].text).toMatch(/^ดูทุกคลิป https?:\/\/.+\/studio\/quote-video$/);
  });

  it("nothing goes when not linked, or when that switch is off", async () => {
    expect(await line.tellAgentClipDone(AGENT, {}, "วิดีโอนำเสนอ", "")).toBe(false);
    await linked();
    await line.setAgentNotify(AGENT, "clipFailed", false);
    expect(await line.tellAgentClipFailed(AGENT, {}, "วิดีโอนำเสนอ", "", "คืนเงินแล้ว")).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("a clip ordered in the LINE chat goes back there with the switch off; near the month's limit it is held", async () => {
    await linked();
    await line.setAgentNotify(AGENT, "clipDone", false);
    expect(await line.deliverClipDone(AGENT, {}, "วิดีโอนำเสนอ", "")).toBe("off");
    expect(await line.deliverClipDone(AGENT, {}, "วิดีโอนำเสนอ", "", null, { force: true })).toBe("sent");
    expect(await line.deliverClipDone(AGENT, {}, "วิดีโอนำเสนอ", "", null, { force: true, held: async () => true })).toBe("held");
    expect(push).toHaveBeenCalledTimes(1);
    await line.unlinkAgent(AGENT);
    expect(await line.deliverClipDone(AGENT, {}, "วิดีโอนำเสนอ", "", null, { force: true })).toBe("unlinked");
  });

  it("money low is off at first; once on, it goes once below ฿50 until the balance is back above", async () => {
    await linked();
    expect(await line.checkMoneyLow(AGENT, 1000)).toBe(false);
    await line.setAgentNotify(AGENT, "moneyLow", true);
    expect(await line.checkMoneyLow(AGENT, 1000)).toBe(true);
    expect(await line.checkMoneyLow(AGENT, 800)).toBe(false);
    expect(await line.checkMoneyLow(AGENT, 20_000)).toBe(false);
    expect(await line.checkMoneyLow(AGENT, 900)).toBe(true);
    expect(push).toHaveBeenCalledTimes(2);
    expect((push.mock.calls[0] as unknown as [string, { text: string }[]])[1][0].text).toMatch(/^💰 เงินในกระเป๋าเหลือ ฿10\n/);
  });

  it("unlinking stops them", async () => {
    await linked();
    await line.unlinkAgent(AGENT);
    expect(await line.tellAgentClipDone(AGENT, {}, "วิดีโอนำเสนอ", "")).toBe(false);
  });
});

describe("words and places", () => {
  it("names the customer with คุณ once", () => {
    expect(line.clipName("วิดีโอนำเสนอ · iShield", "คุณสมศรี")).toBe("วิดีโอนำเสนอ · iShield · คุณสมศรี");
    expect(line.clipName("วิดีโอนำเสนอ · iShield", "  ")).toBe("วิดีโอนำเสนอ · iShield");
  });
  it("sends each clip to the board it was made on", () => {
    expect(line.clipBoard({ product: "LIFEPROTECT" })).toBe("/studio/quote-video");
    expect(line.clipBoard({ product: "ISHIELD", ad: { mode: "ai" } })).toBe("/studio/ad-video");
  });
});

describe("migration 20261218", () => {
  const sql = readFileSync("supabase/migrations/20261218_agent_line.sql", "utf8");
  const fn = (s: string) => {
    const at = s.indexOf("create or replace function public.ins_member_delete");
    expect(at).toBeGreaterThanOrEqual(0);
    return s.slice(at, s.indexOf("$$;", s.indexOf("$$", s.indexOf("$$", at) + 2)) + 3);
  };
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("--"));

  it("makes the table, service-role only, one agent per waiting code", () => {
    expect(sql).toMatch(/create table if not exists public\.ins_agent_line/);
    expect(sql).toMatch(/create unique index if not exists ins_agent_line_code on public\.ins_agent_line \(link_code\) where link_code is not null/);
    expect(sql).toMatch(/alter table public\.ins_agent_line enable row level security/);
    expect(sql).toMatch(/revoke all on public\.ins_agent_line from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy/);
  });

  it("member delete takes the link, the live function otherwise unchanged", () => {
    const mine = fn(sql);
    const live = fn(readFileSync("supabase/migrations/20261215_library_uploads.sql", "utf8"));
    expect(mine).toMatch(/delete from ins_agent_line where agent_id = p_member;/);
    expect(mine).toMatch(/ins_update_reads/);
    expect(lines(mine).filter((l) => !/ins_agent_line/.test(l))).toEqual(lines(live));
    expect(sql).toMatch(/grant execute on function public\.ins_member_delete\(uuid\) to service_role/);
  });
});

describe("เชื่อม LINE inside LINE (owner chose ง, 2026-11-21)", () => {
  const LIFF = "2001234567-AbCdEfGh";

  it("an agent with a code gets the fixed QR; a member's code becomes a one-time LIFF link", async () => {
    const agent = lineViewOf(await line.agentLine(AGENT), { liffId: LIFF, byCode: true });
    expect(agent.team).toBe(`https://liff.line.me/${LIFF}`);
    expect(agent.pending).toBeNull();
    const { code } = await line.startAgentLink(AGENT);
    const member = lineViewOf(await line.agentLine(AGENT), { liffId: LIFF, byCode: false });
    expect(member.team).toBeNull();
    expect(member.pending).toMatchObject({ code, url: `https://liff.line.me/${LIFF}?lt=${code}`, words: null });
    // without the LIFF app, the code typed into the chat as before
    expect(lineViewOf(await line.agentLine(AGENT)).pending?.words).toBe(`ผูก ${code}`);
  });

  it("links this LINE, and the waiting code stops working", async () => {
    const { code } = await line.startAgentLink(AGENT);
    expect(await line.agentOfLinkCode(code)).toBe(AGENT);
    expect(await line.lineIsLinked("Uabc")).toBe(false);
    await line.linkAgentLine(AGENT, "Uabc");
    expect(await line.lineIsLinked("Uabc")).toBe(true);
    expect(await line.agentOfLinkCode(code)).toBeNull();
    expect((await line.agentLine(AGENT)).linked).toBe(true);
  });

  it("an expired or made-up one-time link is nobody's", async () => {
    const { code } = await line.startAgentLink(AGENT);
    expect(await line.agentOfLinkCode(code, Date.now() + 11 * 60_000)).toBeNull();
    expect(await line.agentOfLinkCode("12a456")).toBeNull();
  });

  it("says whether LINE can reach the linked chat, with its name", async () => {
    expect(await line.agentLineFriend(AGENT)).toBeUndefined();
    await line.linkAgentLine(AGENT, "Uabc");
    expect(await line.agentLineFriend(AGENT)).toEqual({ friend: true, name: "Boy" });
    friendProfile.mockResolvedValueOnce(null);
    expect(await line.agentLineFriend(AGENT)).toEqual({ friend: false, name: "" });
    friendProfile.mockResolvedValueOnce(undefined);
    expect(await line.agentLineFriend(AGENT)).toBeUndefined();
    const view = lineViewOf(await line.agentLine(AGENT), { liffId: LIFF, byCode: true }, { friend: false, name: "" });
    expect(view.friend).toEqual({ friend: false, name: "" });
    expect(view.addFriend).toBe("https://line.me/R/ti/p/%40006crkvq");
  });

  it("the test button pushes one message to the linked LINE only", async () => {
    expect(await line.sendAgentTest(AGENT)).toBe("unlinked");
    expect(push).not.toHaveBeenCalled();
    await line.linkAgentLine(AGENT, "Uabc");
    expect(await line.sendAgentTest(AGENT)).toBe("sent");
    expect(push).toHaveBeenCalledWith("Uabc", [{ type: "text", text: line.agentTestText() }]);
  });
});
