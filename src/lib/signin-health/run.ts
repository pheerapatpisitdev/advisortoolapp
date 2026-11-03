// One round of การเชื่อมต่อ (./rules.ts): ask, fold in, save, keep the outage history, and
// tell the owner's LINE what changed. Run every 30 minutes by the database's scheduler and by
// the page's "ตรวจตอนนี้". Server only.
import { fresh, step, type Event, type Health } from "@/lib/ai/health-rules";
import { alertSigninDown } from "@/lib/line/owner-alert";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";
import { checkAll } from "./checks";
import { isRoute, signinAlertText, type Route } from "./rules";

export interface Standing extends Health { route: Route; lastMs: number | null }

interface Row {
  route: string; ok: boolean; fails: number; down_since: string | null;
  last_checked: string | null; last_error: string | null; alerted: boolean; last_ms: number | null;
}

const fromRow = (r: Row): Standing => ({
  route: r.route as Route, provider: r.route, ok: r.ok, fails: r.fails, downSince: r.down_since,
  lastChecked: r.last_checked, lastError: r.last_error, alerted: r.alerted, lastMs: r.last_ms,
});

export async function readStanding(): Promise<Standing[]> {
  const { data, error } = await supabaseAdmin().from("ins_signin_health")
    .select("route, ok, fails, down_since, last_checked, last_error, alerted, last_ms");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).filter((r) => isRoute(r.route)).map(fromRow);
}

/** The outage history: a row opens when the owner is told it is down, and closes when it is back. */
async function keepHistory(events: Event[]): Promise<void> {
  const db = supabaseAdmin();
  for (const e of events) {
    const { error } = e.kind === "down"
      ? await db.from("ins_signin_outages").insert({ route: e.provider, started_at: e.since, error: e.error })
      : await db.from("ins_signin_outages").update({ ended_at: e.at }).eq("route", e.provider).is("ended_at", null);
    if (error) console.error("[signin-health] history not kept:", error.message);
  }
}

export interface SigninRun { standing: Standing[]; events: Event[]; sent: boolean }

export async function runSigninCheck(now = new Date()): Promise<SigninRun> {
  const at = now.toISOString();
  const [results, prior] = await Promise.all([checkAll(), readStanding()]);
  const before = new Map(prior.map((s) => [s.route, s]));
  const events: Event[] = [];
  const standing: Standing[] = results.map((r) => {
    const { next, event } = step(before.get(r.route) ?? fresh(r.route), r, at);
    if (event) events.push(event);
    return { ...next, route: r.route, lastMs: r.ms };
  });

  const { error } = await supabaseAdmin().from("ins_signin_health").upsert(standing.map((s) => ({
    route: s.route, ok: s.ok, fails: s.fails, down_since: s.downSince, last_checked: s.lastChecked,
    last_error: s.lastError, alerted: s.alerted, last_ms: s.lastMs,
  })), { onConflict: "route" });
  if (error) throw new Error(error.message);
  await keepHistory(events);

  const text = signinAlertText(events, siteUrl("/admin/connections"));
  const sent = text ? await alertSigninDown(text) : false;
  return { standing, events, sent };
}
