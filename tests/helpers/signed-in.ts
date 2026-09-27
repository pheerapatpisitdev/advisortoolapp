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
  agentId: "00000000-0000-4000-8000-000000000001",
  code: "015495",
  name: "เจ้าของ",
  tenantId: "00000000-0000-4000-8000-000000000083",
  tenantSlug: "83g",
  tenantName: "83G",
  trial: false,
  staff: { owner: true, publish: true, connect: true, admin: true },
};

export const asOwner = {
  getViewer: async () => OWNER,
  requireMember: async () => OWNER,
  requireStaff: async () => OWNER,
  refuseUnless: async () => null,
  gatePage: async () => OWNER,
  audit: async () => {},
  whoOf: () => ({ name: OWNER.name, room: OWNER.tenantName, publish: true, connect: true, admin: true, owner: true }),
  agentById: async () => null,
  agentsByCode: async () => [],
  staffRow: async () => null,
};
