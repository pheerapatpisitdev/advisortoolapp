/**
 * The describe-history table and its thumbnail bucket, in memory, for the store's tests.
 *
 *   vi.mock("@/lib/supabase/admin", async () => {
 *     const { historyDb } = await import("../helpers/fake-history-db");
 *     return { supabaseAdmin: () => historyDb.client };
 *   });
 *
 * One table (ins_describe_history) and one bucket (describe-thumbs), honouring only the calls
 * the store makes: insert, select, delete, eq, in, order, limit, range — and upload, remove,
 * createSignedUrls. `created_at` rises by a second with every insert, as the database's clock
 * would. Every answer is a copy, so code holding an old read never sees a later write.
 */

type Row = Record<string, unknown>;
type Err = { message: string } | null;

const TABLE = "ins_describe_history";
const BUCKET = "describe-thumbs";
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const historyDb = {
  rows: [] as Row[],
  /** path → the thumbnail's base64 */
  files: new Map<string, string>(),
  /** the next upload / insert answers an error, once */
  failNext: {} as { upload?: boolean; insert?: boolean },
  /** how many times the table or the bucket was asked for */
  calls: 0,
  clock: 0,
  reset() {
    this.rows = [];
    this.files = new Map();
    this.failNext = {};
    this.calls = 0;
    this.clock = 0;
  },
  client: null as never,
};

class Query {
  private op: "select" | "insert" | "delete" = "select";
  private payload: Row | null = null;
  private eqs: [string, unknown][] = [];
  private ins: [string, unknown[]][] = [];
  private sort: { col: string; asc: boolean } | null = null;
  private from = 0;
  private to = Infinity;

  select() { return this; }
  insert(row: Row) { this.op = "insert"; this.payload = row; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, v: unknown) { this.eqs.push([col, v]); return this; }
  in(col: string, vs: unknown[]) { this.ins.push([col, vs]); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.sort = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.to = Math.min(this.to, this.from + n - 1); return this; }
  range(a: number, b: number) { this.from = a; this.to = b; return this; }

  private matching(): Row[] {
    return historyDb.rows.filter((r) =>
      this.eqs.every(([c, v]) => r[c] === v) && this.ins.every(([c, vs]) => vs.includes(r[c])));
  }

  then(ok: (v: { data: unknown; error: Err }) => unknown, bad?: (e: unknown) => unknown) {
    return Promise.resolve(this.run()).then(ok, bad);
  }

  private run(): { data: unknown; error: Err } {
    if (this.op === "insert") {
      if (historyDb.failNext.insert) { historyDb.failNext.insert = false; return { data: null, error: { message: "insert failed" } }; }
      const created_at = new Date(Date.UTC(2026, 9, 8, 0, 0, ++historyDb.clock)).toISOString();
      historyDb.rows.push({ created_at, ...clone(this.payload as Row) });
      return { data: null, error: null };
    }
    if (this.op === "delete") {
      const gone = new Set(this.matching());
      historyDb.rows = historyDb.rows.filter((r) => !gone.has(r));
      return { data: null, error: null };
    }
    let found = this.matching();
    if (this.sort) {
      const { col, asc } = this.sort;
      found = [...found].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
    }
    return { data: clone(found.slice(this.from, this.to + 1)), error: null };
  }
}

const bucket = {
  async upload(path: string, bytes: Buffer, opts?: { upsert?: boolean }) {
    if (historyDb.failNext.upload) { historyDb.failNext.upload = false; return { data: null, error: { message: "upload failed" } }; }
    if (historyDb.files.has(path) && !opts?.upsert) return { data: null, error: { message: "already exists" } };
    historyDb.files.set(path, bytes.toString("base64"));
    return { data: { path }, error: null };
  },
  async remove(paths: string[]) {
    for (const p of paths) historyDb.files.delete(p);
    return { data: paths.map((path) => ({ name: path })), error: null };
  },
  async createSignedUrls(paths: string[]) {
    return {
      data: paths.map((path) => historyDb.files.has(path)
        ? { path, signedUrl: `https://signed.test/${path}`, error: null }
        : { path, signedUrl: null, error: "Object not found" }),
      error: null,
    };
  },
};

historyDb.client = {
  from(table: string) {
    historyDb.calls++;
    if (table !== TABLE) throw new Error(`the fake has no table ${table}`);
    return new Query();
  },
  storage: {
    from(name: string) {
      historyDb.calls++;
      if (name !== BUCKET) throw new Error(`the fake has no bucket ${name}`);
      return bucket;
    },
  },
} as never;
