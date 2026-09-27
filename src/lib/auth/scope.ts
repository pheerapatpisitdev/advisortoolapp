import { cache } from "react";
import { getViewer, staffAgentIds } from "./viewer";

/**
 * Whose Studio rows a request may see (owner, 2026-09-27).
 *
 * A piece is its writer's: an agent sees their own. Staff share one Page, so they see every
 * piece any staff member wrote — the pool the calendar draws from — and the pieces written
 * before owners were kept, which were all the owner's. A person in the people library is the
 * room's: agents of one office photograph each other.
 *
 * Read by the stores themselves (src/lib/content/store.ts, people-store.ts), so no list or
 * lookup can forget to ask. Three answers:
 * - `ALL`: no request at all — work finishing after the answer went back (`after()`), where
 *   there are no cookies to read. That work was started by a request that was checked.
 * - `NONE`: a request from nobody signed in. The gates turn these away before a store is
 *   reached; this is what a store answers if one ever is not.
 * - otherwise the agents (or the room) this viewer may see.
 */
export interface Scope {
  /** agents whose rows are visible; null = everybody's */
  agents: string[] | null;
  /** rows with no owner (written before 2026-09-27, or by an agent since removed) */
  unowned: boolean;
  /** the room whose people library is visible; null = every room's */
  room: string | null;
  /** who writes a new row, for its owner columns */
  owner: { agentId: string; tenantId: string } | null;
}

const ALL: Scope = { agents: null, unowned: true, room: null, owner: null };
const NONE: Scope = { agents: [], unowned: false, room: "", owner: null };

export const currentScope = cache(async (): Promise<Scope> => {
  let viewer;
  try {
    viewer = await getViewer();
  } catch {
    // cookies() refuses outside a request: this is after() work, begun by a checked request
    return ALL;
  }
  if (!viewer) return NONE;
  const owner = { agentId: viewer.agentId, tenantId: viewer.tenantId };
  if (viewer.staff) return { agents: await staffAgentIds(), unowned: true, room: viewer.tenantId, owner };
  return { agents: [viewer.agentId], unowned: false, room: viewer.tenantId, owner };
});

export function maySee(scope: Scope, agentId: string | null | undefined): boolean {
  if (!agentId) return scope.unowned;
  return scope.agents === null || scope.agents.includes(agentId);
}

export function roomMaySee(scope: Scope, tenantId: string | null | undefined): boolean {
  if (scope.room === null) return true;
  if (!tenantId) return scope.unowned;
  return tenantId === scope.room;
}

/** The same rule as a PostgREST `or` filter on agent_id; null when everything is visible. */
export function agentFilter(scope: Scope): string | null {
  if (scope.agents === null) return null;
  const parts = scope.agents.length ? [`agent_id.in.(${scope.agents.join(",")})`] : [];
  if (scope.unowned) parts.push("agent_id.is.null");
  // nothing visible: a filter no row can pass
  return parts.length ? parts.join(",") : "agent_id.eq.00000000-0000-0000-0000-000000000000";
}

export function roomFilter(scope: Scope): string | null {
  if (scope.room === null) return null;
  const parts = scope.room ? [`tenant_id.eq.${scope.room}`] : [];
  if (scope.unowned) parts.push("tenant_id.is.null");
  return parts.length ? parts.join(",") : "tenant_id.eq.00000000-0000-0000-0000-000000000000";
}
