/**
 * A stand-in for the service-role Supabase client, for code that builds queries itself.
 *
 *   vi.mock("@/lib/supabase/admin", async () => {
 *     const { db } = await import("../helpers/fake-db");
 *     return { supabaseAdmin: () => db.client };
 *   });
 *
 * Every `from(table)` records the calls made on it (`select`, `eq`, `insert`, …) and, when
 * awaited, answers with what `db.on(table, …)` said — a fixed answer, or a function of the
 * calls so one table can answer two different questions. `rpc(fn, args)` is table `rpc:fn`.
 */
export type Step = { method: string; args: unknown[] };
export type Answer = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
type Handler = (steps: Step[]) => Answer;

function query(table: string, first?: Step) {
  const steps: Step[] = first ? [first] : [];
  db.log.push({ table, steps });
  const chain: object = new Proxy({}, {
    get(_target, method) {
      if (method === "then") {
        const answer = (db.handlers.get(table) ?? (() => ({})))(steps);
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null, count: null, ...answer }).then(ok, bad);
      }
      return (...args: unknown[]) => {
        steps.push({ method: String(method), args });
        return chain;
      };
    },
  });
  return chain as never;
}

export const db = {
  handlers: new Map<string, Handler>(),
  log: [] as { table: string; steps: Step[] }[],
  on(table: string, answer: Answer | Handler) {
    this.handlers.set(table, typeof answer === "function" ? answer : () => answer);
  },
  reset() {
    this.handlers.clear();
    this.log.length = 0;
  },
  /** the calls of every query on a table that began with `method` (insert, update, …) */
  writes(table: string, method: string): Step[][] {
    return this.log.filter((l) => l.table === table && l.steps.some((s) => s.method === method)).map((l) => l.steps);
  },
  client: {
    from: (table: string) => query(table),
    rpc: (fn: string, args?: unknown) => query(`rpc:${fn}`, { method: "rpc", args: [args] }),
  },
};

/** whether a query called `method` with these leading arguments */
export function has(steps: Step[], method: string, ...args: unknown[]): boolean {
  return steps.some((s) => s.method === method && args.every((a, i) => s.args[i] === a));
}
