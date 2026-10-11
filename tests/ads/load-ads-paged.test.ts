import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/ads reads every row and says when a read failed (review, 2026-10-11): a single
 * select stopped at a thousand rows, and a failed one was drawn as zero.
 */
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  failing: new Set<string>(),
  ranges: [] as [string, number, number][],
}));

function query(table: string) {
  let bounds: [number, number] | null = null;
  let one = false;
  const q = {
    select: () => q, gte: () => q, order: () => q, limit: () => q,
    maybeSingle: () => { one = true; return q; },
    range: (from: number, to: number) => { bounds = [from, to]; db.ranges.push([table, from, to]); return q; },
    then(resolve: (v: unknown) => void) {
      if (db.failing.has(table)) return resolve({ data: null, error: { message: "boom" } });
      const all = db.tables[table] ?? [];
      if (one) return resolve({ data: all[0] ?? null, error: null });
      // PostgREST's own cap: a thousand rows, whatever was asked for
      const rows = bounds ? all.slice(bounds[0], bounds[1] + 1) : all.slice(0, 1000);
      resolve({ data: rows, error: null });
    },
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: query }) }));
vi.mock("@/lib/auth/viewer", () => ({ requireStaff: vi.fn(async () => ({})), audit: vi.fn() }));
vi.mock("@/lib/facebook/ads-connection", () => ({
  adAccounts: vi.fn(async () => []), adSyncStatuses: vi.fn(async () => null), readPendingAds: vi.fn(async () => null),
  adAccountToken: vi.fn(), clearAdAccount: vi.fn(), clearPendingAds: vi.fn(), saveAdAccount: vi.fn(),
}));
vi.mock("@/lib/facebook/oauth", () => ({ listAdAccounts: vi.fn(), tokenExpiry: vi.fn() }));
vi.mock("@/lib/ads/sync", () => ({ syncAds: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const summary = vi.hoisted(() => ({ summariseAds: vi.fn((..._args: unknown[]) => ({})) }));
vi.mock("@/lib/ads/summary", () => summary);

const { loadAds } = await import("@/app/admin/ads/actions");

beforeEach(() => {
  db.tables = {};
  db.failing.clear();
  db.ranges = [];
  summary.summariseAds.mockClear();
});

describe("/admin/ads reads", () => {
  it("counts every conversation past a thousand", async () => {
    db.tables.ins_conversations = Array.from({ length: 1_234 }, (_, i) => ({ ad_id: `ad${i % 3}`, priced_at: null, form_sent_at: null }));
    db.tables.ins_leads = [{ ad_id: "ad1" }, { ad_id: null }];
    const page = await loadAds("30d");
    const [, leads, conversations] = summary.summariseAds.mock.calls[0] as [unknown, unknown[], unknown[]];
    expect(conversations).toHaveLength(1_234);
    expect(leads).toHaveLength(1);
    expect(page.readFailures).toEqual([]);
  });

  it("says which read failed instead of drawing it as zero", async () => {
    db.failing.add("ins_leads");
    const page = await loadAds("7d");
    expect(page.readFailures).toEqual(["ลีด"]);
  });
});
