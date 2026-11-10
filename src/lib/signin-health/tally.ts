// The counting behind การเชื่อมต่อ's numbers, kept apart from the database so it can be tested:
// sign-ins per way in, the room table and the seven days of tries.
import { OPEN_ROOMS } from "@/lib/auth/access";
import type { Route } from "./rules";

export interface LoginRow { agent_id: string; how: string; at: string }

/**
 * Which way in a sign-in came by (src/lib/auth/login-log.ts writes `how`). A code is UnitOS's
 * or Bluewealth's by whose id it signed in; the Super Admin's Google sign-in is not a member's.
 * A KingClub agent's, by menu or code, is KingClub's (2026-11-11).
 */
export function routeOf(l: LoginRow, unitos: Set<string>, bluewealth: Set<string>, kingclub: Set<string> = new Set()): Route | null {
  if ((l.how === "sso" || l.how === "code") && kingclub.has(l.agent_id)) return "kingclub";
  if (l.how === "sso") return "unitos-sso";
  if (l.how === "google") return "google";
  if (l.how === "code") return unitos.has(l.agent_id) ? "unitos-code" : bluewealth.has(l.agent_id) ? "bluewealth" : null;
  return null;
}

export interface RouteUse { week: number; last: string | null }

/** Sign-ins of the last 7 days and the latest one, per way in. */
export function tallyByRoute(logins: LoginRow[], unitos: Set<string>, bluewealth: Set<string>, now: number, kingclub: Set<string> = new Set()): Record<Route, RouteUse> {
  const out: Record<Route, RouteUse> = {
    "unitos-code": { week: 0, last: null }, "unitos-sso": { week: 0, last: null },
    bluewealth: { week: 0, last: null }, kingclub: { week: 0, last: null }, google: { week: 0, last: null },
  };
  const weekAgo = now - 7 * 86_400_000;
  for (const l of logins) {
    const r = routeOf(l, unitos, bluewealth, kingclub);
    if (!r) continue;
    if (Date.parse(l.at) >= weekAgo) out[r].week += 1;
    if (!out[r].last || l.at > out[r].last!) out[r].last = l.at;
  }
  return out;
}

export type Tone = "ok" | "warn" | "bad" | "off";

export interface RoomConfig { features?: Record<string, unknown> | null; isDemo?: unknown }
export interface TenantRow { id: string; name: string | null; slug: string; status: string; config: RoomConfig | null }

/** A UnitOS room as its agents meet it at the door (the same tests as access.ts admitRoom). */
export function roomState(t: TenantRow): { label: string; tone: Tone } {
  if (t.config?.isDemo) return { label: "ห้องสาธิต ปิดไว้", tone: "off" };
  const f = t.config?.features;
  if (f?.advisorTool === false || f?.adStudio === false) return { label: "ปิด advisortool", tone: "off" };
  if (!OPEN_ROOMS.includes(t.status)) return { label: "ห้องปิด", tone: "off" };
  if (t.status === "trialing") return { label: "ทดลองใช้", tone: "ok" };
  if (t.status === "past_due") return { label: "ค้างชำระ", tone: "warn" };
  return { label: "เปิดใช้", tone: "ok" };
}

export interface RoomLine {
  name: string;
  system: "UnitOS" | "Bluewealth" | "KingClub";
  label: string;
  tone: Tone;
  /** every agent of the room; for Bluewealth and KingClub only those who have signed in here */
  agents: number;
  seenOnly: boolean;
  week: number;
  last: string | null;
}

/** Sorted by the week's sign-ins, then by size: the rooms that use it most come first. */
export function sortRooms(rooms: RoomLine[]): RoomLine[] {
  return [...rooms].sort((a, b) => b.week - a.week || b.agents - a.agents || a.name.localeCompare(b.name));
}

/** "2026-11-03" for an instant, by the clock in Bangkok. */
export const bangkokDay = (iso: string | number) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

export interface DayTries { day: string; ok: number; failed: number }

/** The code tab's tries over the last seven days in Bangkok, today last, days with none kept. */
export function triesByDay(rows: { ok: boolean; created_at: string }[], now: number): DayTries[] {
  const days = Array.from({ length: 7 }, (_, i) => bangkokDay(now - (6 - i) * 86_400_000));
  const by = new Map(days.map((d) => [d, { day: d, ok: 0, failed: 0 }]));
  for (const r of rows) {
    const d = by.get(bangkokDay(r.created_at));
    if (d) d[r.ok ? "ok" : "failed"] += 1;
  }
  return days.map((d) => by.get(d)!);
}
