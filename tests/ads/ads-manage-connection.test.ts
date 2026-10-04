import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The ads_management token lives in the same encrypted table as the ads_read one, under a key
 * of its own. The database is stood in for here — never the real one — and what is checked is
 * which key each call writes and reads, and that a listing carries no token.
 */

const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let stored: Record<string, unknown>[] = [];
const rows = [
  { key: "facebook:1", page_id: "1", page_name: "เพจ", fields: [], updated_at: "2026-10-01T00:00:00Z" },
  { key: "facebook_ads:act_9", page_id: "act_9", page_name: "อ่านอย่างเดียว", fields: ["THB"], updated_at: "2026-10-02T00:00:00Z" },
  { key: "facebook_ads_manage:act_1", page_id: "act_1", page_name: "ยิงแอด", fields: ["THB"], updated_at: "2026-10-03T00:00:00Z" },
  { key: "facebook_ads_manage_pending", page_id: null, page_name: null, fields: [], updated_at: "2026-10-03T00:00:00Z" },
];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "ins_get_channel_auth") return { data: stored, error: null };
      return { data: null, error: null };
    },
    from: (table: string) => {
      expect(table).toBe("ins_channel_auth");
      return { select: () => ({ order: async () => ({ data: rows, error: null }) }) };
    },
  }),
}));

process.env.ADMIN_SESSION_SECRET = "test-secret";
const {
  adManageAccounts, adManageToken, clearPendingAdsManage, readPendingAdsManage, saveAdManageAccount, savePendingAdsManage,
} = await import("@/lib/facebook/ads-manage-connection");

beforeEach(() => { rpcCalls.length = 0; stored = []; });

describe("saving the ads_management token", () => {
  it("writes one account under its own key, with the currency in fields", async () => {
    await saveAdManageAccount({ id: "act_1", name: "ยิงแอด", currency: "THB", token: "tok", scopes: ["ads_management"] });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("ins_set_channel_auth");
    expect(rpcCalls[0].args).toMatchObject({
      p_key: "facebook_ads_manage:act_1",
      p_page_id: "act_1",
      p_page_name: "ยิงแอด",
      p_token: "tok",
      p_scopes: ["ads_management"],
      p_fields: ["THB"],
    });
  });

  it("keeps no currency word when the account has none", async () => {
    await saveAdManageAccount({ id: "act_1", name: "x", currency: null, token: "tok", scopes: [] });
    expect(rpcCalls[0].args.p_fields).toEqual([]);
  });

  it("holds the login under the pending key until an account is picked", async () => {
    await savePendingAdsManage("user-tok", ["ads_management"]);
    expect(rpcCalls[0].fn).toBe("ins_set_channel_auth");
    expect(rpcCalls[0].args).toMatchObject({
      p_key: "facebook_ads_manage_pending", p_page_id: null, p_token: "user-tok", p_scopes: ["ads_management"],
    });
  });
});

describe("reading it back", () => {
  it("lists only the ads_management accounts, with no token", async () => {
    const list = await adManageAccounts();
    expect(list).toEqual([{ id: "act_1", name: "ยิงแอด", currency: "THB", connectedAt: "2026-10-03T00:00:00Z" }]);
    expect(JSON.stringify(list)).not.toContain("token");
  });

  it("asks for an account's token by its own key", async () => {
    stored = [{ key: "facebook_ads_manage:act_1", token: "secret", scopes: ["ads_management"] }];
    expect(await adManageToken("act_1")).toBe("secret");
    expect(rpcCalls[0].fn).toBe("ins_get_channel_auth");
    expect(rpcCalls[0].args.p_key).toBe("facebook_ads_manage:act_1");
  });

  it("answers null for an account with no token", async () => {
    expect(await adManageToken("act_1")).toBeNull();
  });

  it("reads and clears the pending login by its key", async () => {
    stored = [{ key: "facebook_ads_manage_pending", token: "user-tok", scopes: null }];
    expect(await readPendingAdsManage()).toEqual({ token: "user-tok", scopes: [] });
    expect(rpcCalls[0].args.p_key).toBe("facebook_ads_manage_pending");
    await clearPendingAdsManage();
    expect(rpcCalls[1]).toMatchObject({ fn: "ins_clear_channel_auth", args: { p_key: "facebook_ads_manage_pending" } });
  });
});
