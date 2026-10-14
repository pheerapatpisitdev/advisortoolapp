import type { Viewer } from "@/lib/auth/access";

/**
 * The owner, signed in — for tests of actions that ask who is calling before they do anything.
 *
 *   vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
 *
 * The whole module is replaced rather than getViewer alone, because requireMember and friends
 * call getViewer inside the module, where a mock of the export would not reach.
 */
export const OWNER: Viewer = {
  kind: "unitos",
  agentId: "00000000-0000-4000-8000-000000000001",
  code: "015495",
  name: "เจ้าของ",
  tenantId: "00000000-0000-4000-8000-000000000083",
  tenantSlug: "83g",
  tenantName: "83G",
  trial: false,
  staff: { owner: true, publish: true, connect: true, admin: true },
};

/** The Super Admin, signed in at /backoffice (owner, 2026-10-15): the back office's only user. */
export const SUPER: Viewer = {
  kind: "super",
  agentId: "00000000-0000-4000-8000-0000000000ad",
  code: "boss@gmail.com",
  name: "boss@gmail.com",
  tenantId: null,
  tenantSlug: "",
  tenantName: "Super Admin",
  trial: false,
  staff: null,
};

export const asOwner = {
  getViewer: async () => OWNER,
  requireMember: async () => OWNER,
  requireStaff: async () => OWNER,
  refuseUnless: async () => null,
  gatePage: async () => OWNER,
  audit: async () => {},
  whoOf: () => ({ name: OWNER.name, room: OWNER.tenantName, publish: true, connect: true, admin: true, owner: true, member: false }),
  memberById: async () => null,
  displayNames: async () => ({}),
  agentById: async () => null,
  agentsByCode: async () => [],
  staffRow: async () => null,
};
