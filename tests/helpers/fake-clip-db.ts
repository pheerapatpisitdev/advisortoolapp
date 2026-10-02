/**
 * One ins_content row and the content-video bucket, in memory, for the clip job tests.
 *
 *   vi.mock("@/lib/supabase/admin", async () => {
 *     const { clipDb } = await import("../helpers/fake-clip-db");
 *     return { supabaseAdmin: () => clipDb.client };
 *   });
 *
 * The row honours the filters PostgREST would: `eq` / `is` on a column or a JSON path
 * ("output->>rev", "output->video->edit->job->>id"), so saveOutputIf's rev guard holds — a
 * write over a row that moved on changes nothing and answers no rows. Every answer is a copy,
 * so code holding an old read never sees a later write.
 */

type Row = Record<string, unknown>;
type Step = { method: string; args: unknown[] };

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** a column or a JSON path read off the row, as text where PostgREST's ->> would give text */
function at(row: Row, path: string): unknown {
  const keys = path.split(/->>?/);
  let cur: unknown = row;
  for (const k of keys) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined;
  return cur;
}

function matches(row: Row, steps: Step[]): boolean {
  return steps.every((s) => {
    if (s.method === "eq") return at(row, String(s.args[0])) !== undefined && String(at(row, String(s.args[0]))) === String(s.args[1]);
    if (s.method === "is") return s.args[1] === null ? at(row, String(s.args[0])) == null : at(row, String(s.args[0])) === s.args[1];
    return true;
  });
}

function answer(steps: Step[]): { data: unknown; error: null } {
  const row = clipDb.row;
  const hit = row !== null && matches(row, steps);
  const update = steps.find((s) => s.method === "update");
  if (update) {
    if (!hit) return { data: [], error: null };
    clipDb.row = { ...row!, ...clone(update.args[0] as Row) };
    clipDb.writes++;
    return { data: [clone(clipDb.row)], error: null };
  }
  if (steps.some((s) => s.method === "maybeSingle" || s.method === "single")) return { data: hit ? clone(row) : null, error: null };
  return { data: hit ? [clone(row)] : [], error: null };
}

function query(): unknown {
  const steps: Step[] = [];
  const chain: object = new Proxy({}, {
    get(_t, method) {
      if (method === "then") {
        // answered when awaited, all at once: two callers racing cannot both pass the guard
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer(steps)).then(ok, bad);
      }
      return (...args: unknown[]) => { steps.push({ method: String(method), args }); return chain; };
    },
  });
  return chain;
}

export const clipDb = {
  row: null as Row | null,
  /** stored files by path: their text, and the type they were stored as */
  files: new Map<string, { text: string; contentType?: string }>(),
  uploads: [] as string[],
  removed: [] as string[],
  signed: [] as string[],
  writes: 0,
  reset(row: Row | null) {
    this.row = clone(row);
    this.files.clear();
    this.uploads.length = 0;
    this.removed.length = 0;
    this.signed.length = 0;
    this.writes = 0;
  },
  client: {
    from: () => query(),
    storage: {
      from: () => ({
        async createSignedUploadUrl(path: string) {
          clipDb.signed.push(path);
          return { data: { signedUrl: `https://storage.test/upload/sign/${path}?token=secret`, token: "secret", path }, error: null };
        },
        async upload(path: string, body: ArrayBuffer | string, opts?: { contentType?: string }) {
          const text = typeof body === "string" ? body : new TextDecoder().decode(body);
          clipDb.files.set(path, { text, contentType: opts?.contentType });
          clipDb.uploads.push(path);
          return { data: { path }, error: null };
        },
        async download(path: string) {
          const f = clipDb.files.get(path);
          return f ? { data: new Blob([f.text]), error: null } : { data: null, error: { message: "Object not found" } };
        },
        async remove(paths: string[]) {
          for (const p of paths) { clipDb.files.delete(p); clipDb.removed.push(p); }
          return { data: [], error: null };
        },
      }),
    },
  },
};
