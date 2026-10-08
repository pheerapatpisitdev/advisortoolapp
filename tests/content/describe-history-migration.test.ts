import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * A member's id is not always a row of UnitOS's agents: a สมาชิกทั่วไป has an id in ins_members
 * (20261001_outside_members.sql dropped exactly this foreign key from the other tables). A
 * history tied to agents(id) saves nothing for them (final review, 2026-10-08).
 */

const dir = path.resolve(__dirname, "../../supabase/migrations");
const read = (f: string) => readFileSync(path.join(dir, f), "utf8");

describe("the history table's agent_id", () => {
  it("is not a foreign key to agents when the table is made", () => {
    expect(read("20261012_describe_history.sql")).not.toMatch(/references\s+(public\.)?agents/i);
  });

  it("has the foreign key dropped from a table that was made with it, with the lock limits the outside-members migration uses", () => {
    const sql = read("20261013_describe_history_no_agent_fk.sql");
    expect(sql).toMatch(/drop constraint if exists ins_describe_history_agent_id_fkey/i);
    expect(sql).toMatch(/set local lock_timeout = '5s'/i);
    expect(sql).toMatch(/set local statement_timeout = '60s'/i);
  });
});
