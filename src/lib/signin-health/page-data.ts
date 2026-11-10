// What /admin/connections shows, read in one go. Server only.
import { bluewealthOpen } from "@/lib/auth/bluewealth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readStanding, type Standing } from "./run";
import type { Route } from "./rules";
import { bangkokDay, roomState, sortRooms, triesByDay, tallyByRoute, type DayTries, type LoginRow, type RoomLine, type RouteUse, type TenantRow } from "./tally";

export interface Outage { id: number; route: Route; startedAt: string; endedAt: string | null; error: string | null }

export interface ConnectionsPage {
  standing: Standing[];
  use: Record<Route, RouteUse>;
  rooms: RoomLine[];
  tries: DayTries[];
  outages: Outage[];
  bluewealthOpen: boolean;
}

const DAY = 86_400_000;

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
}

export async function readConnectionsPage(now = Date.now()): Promise<ConnectionsPage> {
  const db = supabaseAdmin();
  const [standing, logins, agents, outside, kingclub, tenants, tries, outages, open] = await Promise.all([
    readStanding(),
    db.from("ins_logins").select("agent_id, how, at").gte("at", new Date(now - 30 * DAY).toISOString()).limit(5000),
    db.from("agents").select("id, tenant_id").limit(5000),
    db.from("ins_bluewealth_agents").select("id, tenant_name").limit(5000),
    db.from("ins_kingclub_agents").select("id, tenant_name").limit(5000),
    db.from("tenants").select("id, name, slug, status, config").neq("status", "template"),
    // from Bangkok's midnight six days ago, so the first bar is a whole day
    db.from("ins_login_attempts").select("ok, created_at").gte("created_at", new Date(Date.parse(`${bangkokDay(now - 6 * DAY)}T00:00:00+07:00`)).toISOString()).limit(5000),
    db.from("ins_signin_outages").select("id, route, started_at, ended_at, error").gte("started_at", new Date(now - 90 * DAY).toISOString()).order("started_at", { ascending: false }).limit(50),
    bluewealthOpen(),
  ]);

  const loginRows = must(logins, "ins_logins") as LoginRow[];
  const agentRows = must(agents, "agents") as { id: string; tenant_id: string | null }[];
  const outsideRows = must(outside, "ins_bluewealth_agents") as { id: string; tenant_name: string | null }[];
  const unitos = new Set(agentRows.map((a) => a.id));
  const bluewealth = new Set(outsideRows.map((a) => a.id));
  const kingclubRows = must(kingclub, "ins_kingclub_agents") as { id: string; tenant_name: string | null }[];
  const kingclubIds = new Set(kingclubRows.map((a) => a.id));

  // each room's sign-ins of the week and its latest, by code or by UnitOS's menu
  const roomOf = new Map<string, string>([
    ...agentRows.filter((a) => a.tenant_id).map((a) => [a.id, `u:${a.tenant_id}`] as [string, string]),
    ...outsideRows.map((a) => [a.id, `b:${a.tenant_name?.trim() || "Bluewealth"}`] as [string, string]),
    // after UnitClub's: KingClub's agents are still in UnitClub's rows, under their old, closed room
    ...kingclubRows.map((a) => [a.id, `k:${a.tenant_name?.trim() || "KingClub"}`] as [string, string]),
  ]);
  const weekAgo = now - 7 * DAY;
  const roomUse = new Map<string, RouteUse>();
  for (const l of loginRows) {
    const room = (l.how === "code" || l.how === "sso") ? roomOf.get(l.agent_id) : undefined;
    if (!room) continue;
    const u = roomUse.get(room) ?? { week: 0, last: null };
    if (Date.parse(l.at) >= weekAgo) u.week += 1;
    if (!u.last || l.at > u.last) u.last = l.at;
    roomUse.set(room, u);
  }

  const bwStanding = standing.find((s) => s.route === "bluewealth");
  const bwState = !open
    ? { label: "ปิดอยู่ (สวิตช์)", tone: "off" as const }
    : bwStanding && !bwStanding.ok ? { label: "ต่อไม่ได้", tone: "bad" as const } : { label: "เปิดใช้", tone: "ok" as const };
  const bwRooms = new Map<string, number>();
  for (const a of outsideRows) {
    const name = a.tenant_name?.trim() || "Bluewealth";
    bwRooms.set(name, (bwRooms.get(name) ?? 0) + 1);
  }

  const kcStanding = standing.find((s) => s.route === "kingclub");
  const kcState = kcStanding && !kcStanding.ok ? { label: "ต่อไม่ได้", tone: "bad" as const } : { label: "เปิดใช้", tone: "ok" as const };
  const kcRooms = new Map<string, number>();
  for (const a of kingclubRows) {
    const name = a.tenant_name?.trim() || "KingClub";
    kcRooms.set(name, (kcRooms.get(name) ?? 0) + 1);
  }

  const rooms: RoomLine[] = [
    ...(must(tenants, "tenants") as TenantRow[]).map((t) => {
      const u = roomUse.get(`u:${t.id}`);
      return {
        name: t.name?.trim() || t.slug, system: "UnitOS" as const, ...roomState(t),
        agents: agentRows.filter((a) => a.tenant_id === t.id).length, seenOnly: false,
        week: u?.week ?? 0, last: u?.last ?? null,
      };
    }),
    ...[...bwRooms].map(([name, seen]) => {
      const u = roomUse.get(`b:${name}`);
      return { name, system: "Bluewealth" as const, ...bwState, agents: seen, seenOnly: true, week: u?.week ?? 0, last: u?.last ?? null };
    }),
    ...[...kcRooms].map(([name, seen]) => {
      const u = roomUse.get(`k:${name}`);
      return { name, system: "KingClub" as const, ...kcState, agents: seen, seenOnly: true, week: u?.week ?? 0, last: u?.last ?? null };
    }),
  ];

  return {
    standing,
    use: tallyByRoute(loginRows, unitos, bluewealth, now, kingclubIds),
    rooms: sortRooms(rooms),
    tries: triesByDay(must(tries, "ins_login_attempts") as { ok: boolean; created_at: string }[], now),
    outages: (must(outages, "ins_signin_outages") as { id: number; route: Route; started_at: string; ended_at: string | null; error: string | null }[])
      .map((o) => ({ id: o.id, route: o.route, startedAt: o.started_at, endedAt: o.ended_at, error: o.error })),
    bluewealthOpen: open,
  };
}
