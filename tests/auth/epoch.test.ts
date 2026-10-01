import { beforeEach, describe, expect, it, vi } from "vitest";

/** The stamp that signs an agent out everywhere (src/lib/auth/epoch.ts, review 2026-10-01). */

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const { endEverySession, sessionNotBefore } = await import("@/lib/auth/epoch");

beforeEach(() => db.reset());

describe("endEverySession", () => {
  it("stamps the agent with the app's clock, once per agent", async () => {
    const at = new Date("2026-10-01T03:00:00.123Z");
    await endEverySession("a1", at);
    const [steps] = db.writes("ins_session_epochs", "upsert");
    expect(steps[0].args[0]).toEqual({ agent_id: "a1", not_before: at.toISOString(), updated_at: at.toISOString() });
    expect(steps[0].args[1]).toEqual({ onConflict: "agent_id" });
  });

  it("throws when the stamp does not land", async () => {
    db.on("ins_session_epochs", { error: { message: "down" } });
    await expect(endEverySession("a1", new Date())).rejects.toThrow("down");
  });
});

describe("sessionNotBefore", () => {
  it("is the stamp in ms, or null for an agent who never signed out", async () => {
    db.on("ins_session_epochs", { data: { not_before: "2026-10-01T03:00:00.123Z" } });
    expect(await sessionNotBefore("a1")).toBe(Date.parse("2026-10-01T03:00:00.123Z"));
    db.on("ins_session_epochs", { data: null });
    expect(await sessionNotBefore("a1")).toBeNull();
  });

  it("never throws: a read that fails is logged and is no stamp", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    db.on("ins_session_epochs", { error: { message: "timeout" } });
    expect(await sessionNotBefore("a1")).toBeNull();
    db.on("ins_session_epochs", () => { throw new Error("socket"); });
    expect(await sessionNotBefore("a1")).toBeNull();
    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
});
