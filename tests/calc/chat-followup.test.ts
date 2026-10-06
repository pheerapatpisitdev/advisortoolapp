import { beforeEach, describe, expect, it, vi } from "vitest";

/** what the database was asked to do, in order */
const calls: { fn: string; args: Record<string, unknown> }[] = [];
let secretRow: { secret: string } | null = { secret: "the-word" };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      const claimed = [{ user_hash: "h1", psid: "psid-1", page_id: "page-1", stage: 1 }];
      return { data: fn === "ins_claim_followups" ? claimed : null, error: null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: secretRow }) }) }),
    }),
  }),
}));

const {
  armFollowup, claimDueFollowups, dropFollowup, followupMessage,
  FOLLOWUP_LAST_REPLIES, FOLLOWUP_LAST_TEXT, FOLLOWUP_REPLIES, FOLLOWUP_TEXT, SECOND_FOLLOWUP,
  SILENCE_MS,
} = await import("@/lib/chat/followup");
const { cronCallerIsOurs } = await import("@/lib/chat/cron-token");
const { asksCheaper, stalls, wantsToBuy } = await import("@/lib/assistant/common");
const { asksValueTable } = await import("@/lib/assistant/lifeprotect/route");

beforeEach(() => {
  calls.length = 0;
  secretRow = { secret: "the-word" };
  process.env.ADMIN_SESSION_SECRET = "passphrase";
});

describe("the one question sent into a silence", () => {
  it("is armed five minutes out, and expires within the day Meta allows", async () => {
    const now = new Date("2026-09-15T03:00:00.000Z");
    await armFollowup("facebook", "h1", "psid-1", "page-1", now);
    const { args } = calls[0];
    expect(calls[0].fn).toBe("ins_arm_followup");
    expect(args.p_due_at).toBe(new Date(now.getTime() + SILENCE_MS).toISOString());
    expect(args.p_expires_at).toBe(new Date(now.getTime() + 24 * 3600_000).toISOString());
    expect(SILENCE_MS).toBe(5 * 60_000);
  });

  it("hands the page-scoped id over only to be encrypted, never stored as it arrived", async () => {
    await armFollowup("facebook", "h1", "psid-1", "page-1");
    expect(calls[0].args.p_psid).toBe("psid-1");
    expect(calls[0].args.p_passphrase).toBe("passphrase");
  });

  /**
   * A page-scoped id is only an id to the Page that issued it.
   *
   * With two Pages connected and no Page in the queue, the send an hour later reached for
   * whichever token came first and Meta refused it — so the Page is written down when the
   * follow-up is armed and handed back when it is claimed.
   */
  it("remembers which Page the conversation happened on", async () => {
    await armFollowup("facebook", "h1", "psid-1", "page-1");
    expect(calls[0].args.p_page_id).toBe("page-1");

    const [due] = await claimDueFollowups("facebook");
    expect(due.pageId).toBe("page-1");
  });

  it("is dropped the moment anyone speaks", async () => {
    await dropFollowup("facebook", "h1");
    expect(calls[0]).toMatchObject({ fn: "ins_drop_followup", args: { p_user_hash: "h1" } });
  });

  it("claims what is due, which is the same statement that marks it sent", async () => {
    expect(await claimDueFollowups("facebook"))
      .toEqual([{ userHash: "h1", psid: "psid-1", pageId: "page-1", stage: 1 }]);
    expect(calls[0].fn).toBe("ins_claim_followups");
  });

  it("reads on its own, with the buttons or without them", () => {
    // the Page's inbox draws no buttons, and they go once anything else is said (owner, 2026-10-06)
    expect(FOLLOWUP_TEXT).not.toContain("กดปุ่ม");
    expect(FOLLOWUP_TEXT).not.toContain("สนใจไหม");
    expect(FOLLOWUP_TEXT).toBe("ดูตัวเลขแล้วสงสัยตรงไหน ถามได้เลยครับ");
  });

  it("offers nothing the bot cannot answer, and nothing Messenger would cut", () => {
    for (const title of FOLLOWUP_REPLIES) {
      expect(title.length, title).toBeLessThanOrEqual(20);
      const heard = asksCheaper(title) || asksValueTable(title)
        || wantsToBuy(title, true) || stalls(title);
      expect(heard, title).toBe(true);
    }
  });

  /**
   * The button for the reader who has not decided.
   *
   * Without it the only thing that reader can do with the message is ignore it, and a thread
   * ignored is a thread the agent cannot tell apart from one that never opened it.
   */
  it("gives the undecided a button of their own, and it is not a refusal", () => {
    expect(FOLLOWUP_REPLIES).toContain("ขอเวลาคิดก่อน");
    expect(stalls("ขอเวลาคิดก่อน")).toBe(true);
    expect(wantsToBuy("ขอเวลาคิดก่อน", true)).toBe(false);
  });

  /** Asking to look costs the reader nothing; asking for a discount costs them an admission. */
  it("lets the reader look at a lighter premium without saying they cannot afford this one", () => {
    expect(FOLLOWUP_REPLIES).not.toContain("ขอแบบถูกลง");
    expect(asksCheaper("ดูแบบเบี้ยถูกลง")).toBe(true);
    expect(stalls("ดูแบบเบี้ยถูกลง")).toBe(false);
  });
});

describe("the last question, before the window shuts", () => {
  it("does not ask again what the first one asked", () => {
    expect(FOLLOWUP_LAST_TEXT).not.toContain("เบี้ยเบากว่า");
    expect(FOLLOWUP_LAST_TEXT).not.toContain("จ่ายสั้น");
  });

  it("promises the silence it can actually keep", () => {
    // two is the cap, so saying so is true; a third message would make it a lie
    expect(FOLLOWUP_LAST_TEXT).toContain("ไม่รบกวนต่อแล้ว");
  });

  it("offers nothing the bot cannot answer", () => {
    for (const title of FOLLOWUP_LAST_REPLIES) {
      expect(title.length, title).toBeLessThanOrEqual(20);
      const heard = asksCheaper(title) || asksValueTable(title) || wantsToBuy(title, true);
      expect(heard, title).toBe(true);
    }
  });

  it("is switched off, so the second stage sends nothing at all", () => {
    expect(SECOND_FOLLOWUP).toBe(false);
    expect(followupMessage(2)).toBeNull();
    // anything beyond two was the last message too, and is just as silent
    expect(followupMessage(3)).toBeNull();
  });

  it("takes nothing away from the first stage, which still speaks", () => {
    expect(followupMessage(1)).toEqual({ text: FOLLOWUP_TEXT, replies: FOLLOWUP_REPLIES });
  });
});

describe("who may make the page speak", () => {
  it("is whoever carries the word the database holds", async () => {
    expect(await cronCallerIsOurs("Bearer the-word")).toBe(true);
    expect(await cronCallerIsOurs("the-word")).toBe(true);
  });

  it("is nobody else", async () => {
    expect(await cronCallerIsOurs("Bearer wrong")).toBe(false);
    expect(await cronCallerIsOurs(null)).toBe(false);
    expect(await cronCallerIsOurs("Bearer ")).toBe(false);
  });

  it("is nobody at all when the database holds no word", async () => {
    secretRow = null;
    expect(await cronCallerIsOurs("Bearer the-word")).toBe(false);
  });
});
