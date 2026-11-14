import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BODY_MAX, GROUPS, KINDS, TITLE_MAX } from "@/lib/updates/rules";

/** supabase/migrations/20261211_whats_new.sql: มีอะไรใหม่'s two tables and the two functions it adds a line to */

const sql = readFileSync("supabase/migrations/20261211_whats_new.sql", "utf8");
const fn = (s: string, name: string) => {
  const at = s.indexOf(`create or replace function public.${name}`);
  expect(at, name).toBeGreaterThanOrEqual(0);
  return s.slice(at, s.indexOf("$$;", s.indexOf("$$", s.indexOf("$$", at) + 2)) + 3);
};
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("--"));
const previous = readFileSync("supabase/migrations/20261210_library_marks.sql", "utf8");

describe("whats-new migration", () => {
  it("makes both tables service-role only", () => {
    for (const t of ["ins_updates", "ins_update_reads"]) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${t}`));
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
      expect(sql).toMatch(new RegExp(`revoke all on public\\.${t} from public, anon, authenticated`));
    }
  });
  it("checks the same kinds, groups and limits as the code", () => {
    expect(sql).toContain(`kind in (${KINDS.map((k) => `'${k.key}'`).join(", ")})`);
    expect(sql).toContain(`grp in (${GROUPS.map((g) => `'${g.key}'`).join(", ")})`);
    expect(sql).toContain(`between 1 and ${TITLE_MAX}`);
    expect(sql).toContain(`<= ${BODY_MAX}`);
  });
  it("drops a row's reads with the row", () => {
    expect(sql).toMatch(/references public\.ins_updates \(id\) on delete cascade/);
  });
  it("the member delete takes the reads too, the live function otherwise unchanged", () => {
    const mine = fn(sql, "ins_member_delete");
    expect(mine).toMatch(/delete from ins_update_reads where agent_id = p_member;/);
    expect(lines(mine).filter((l) => !/ins_update_reads/.test(l))).toEqual(lines(fn(previous, "ins_member_delete")));
    expect(mine.indexOf("ins_update_reads")).toBeLessThan(mine.indexOf("delete from ins_members"));
  });
  it("the demo wipe takes the reads too, the live function otherwise unchanged, and schedules nothing", () => {
    const mine = fn(sql, "ins_demo_wipe");
    expect(mine).toMatch(/delete from public\.ins_update_reads where agent_id = demo;/);
    expect(lines(mine).filter((l) => !/ins_update_reads/.test(l))).toEqual(lines(fn(previous, "ins_demo_wipe")));
    expect(sql).not.toMatch(/cron\.schedule/);
    expect(sql).toMatch(/grant execute on function public\.ins_member_delete\(uuid\) to service_role/);
  });
  it("no later migration redefines either function without the reads", () => {
    const later = readdirSync("supabase/migrations").filter((f) => f > "20261211_whats_new.sql");
    for (const f of later) {
      const text = readFileSync(`supabase/migrations/${f}`, "utf8");
      if (/function public\.ins_(member_delete|demo_wipe)/.test(text)) expect(text, f).toMatch(/ins_update_reads/);
    }
  });
});
