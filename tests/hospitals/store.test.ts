import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/** The owner's own department numbers (ins_hospital_phones): read by the page, written by the back office */

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});
import { db, has } from "../helpers/fake-db";
const { clearOwnerPhones, ownerPhones, ownerPhonesOrNone, saveOwnerPhones } = await import("@/lib/hospitals/store");

const T = "ins_hospital_phones";
const NUMBERS = { insurance: ["0 2111 1111"], room: [], appointment: ["1719"], reception: [] };

beforeEach(() => db.reset());

describe("reading them", () => {
  it("is a map by hospital, each with the Bangkok day it was saved", async () => {
    // 18:00 UTC is the next day in Bangkok
    db.on(T, { data: [{ hospital_id: "a-hospital", ...NUMBERS, updated_at: "2026-11-24T18:00:00+00:00" }] });
    expect([...(await ownerPhones())]).toEqual([["a-hospital", { ...NUMBERS, day: "2026-11-25" }]]);
  });
  it("throws when they cannot be read, and the page's own read is empty instead", async () => {
    db.on(T, { error: { message: "down" } });
    await expect(ownerPhones()).rejects.toThrow(/down/);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await ownerPhonesOrNone()).size).toBe(0);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("writing them", () => {
  it("keeps one row a hospital, the last one saved", async () => {
    await saveOwnerPhones("a-hospital", NUMBERS);
    const [steps] = db.writes(T, "upsert");
    const { args } = steps.find((s) => s.method === "upsert")!;
    expect(args[0]).toMatchObject({ hospital_id: "a-hospital", ...NUMBERS });
    expect((args[0] as { updated_at: string }).updated_at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(args[1]).toEqual({ onConflict: "hospital_id" });
  });
  it("takes a hospital's row out", async () => {
    await clearOwnerPhones("a-hospital");
    const [steps] = db.writes(T, "delete");
    expect(has(steps, "eq", "hospital_id", "a-hospital")).toBe(true);
  });
  it("says when a write did not happen", async () => {
    db.on(T, { error: { message: "no" } });
    await expect(saveOwnerPhones("a", NUMBERS)).rejects.toThrow(/no/);
    await expect(clearOwnerPhones("a")).rejects.toThrow(/no/);
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261221_hospital_phones.sql", "utf8");
  it("makes one service-role-only table, additively", () => {
    expect(sql).toMatch(/create table if not exists public\.ins_hospital_phones/);
    expect(sql).toMatch(/hospital_id text primary key/);
    for (const c of ["insurance", "room", "appointment", "reception"]) expect(sql).toMatch(new RegExp(`${c} text\\[\\] not null default '\\{\\}'`));
    expect(sql).toMatch(/alter table public\.ins_hospital_phones enable row level security/);
    expect(sql).toMatch(/revoke all on public\.ins_hospital_phones from public, anon, authenticated/);
    expect(sql).toMatch(/grant all on public\.ins_hospital_phones to service_role/);
    expect(sql).not.toMatch(/\bdrop\b|\btruncate\b|\bdelete\b/i);
  });
});
