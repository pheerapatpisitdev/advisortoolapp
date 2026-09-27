#!/usr/bin/env python3
"""
Build the UnitClub baseline migration from two schema dumps of DATA2.0.

  relations.sql  pg_dump --schema-only with -t for every line of relations.txt
  public.sql     pg_dump --schema-only --schema=public (read here only for the functions)

pg_dump -t brings the tables, views, sequences, indexes, constraints and grants but never the
functions, so those are lifted out of the whole-schema dump by name. What changes on the way:

- vector and pgroonga live in `extensions` on UnitClub, not in `public` as they do on DATA2.0,
  so the type and operator class are re-qualified and ins_search_chunks gets `extensions` on
  its search_path (it is the one search function that had only `public`);
- grants to anon and authenticated are dropped: on UnitClub those roles carry UnitOS's own
  tenant keys, and advisortool reaches its tables with service_role alone;
- the policy that let any signed-in user read model_configs is dropped for the same reason;
- one index that duplicated another on ins_chat_events is left behind.

Usage: build-baseline.py relations.sql public.sql > supabase/migrations/20260927_unitclub_baseline.sql
"""
import re
import sys

FUNCTIONS = [
    "ins_api_client_use", "ins_arm_followup", "ins_attribute", "ins_claim_followups",
    "ins_clear_channel_auth", "ins_drop_followup", "ins_followup_second_due", "ins_get_api_keys",
    "ins_get_channel_auth", "ins_get_lead_psid", "ins_month_spend", "ins_open_conversation",
    "ins_open_lead", "ins_prune", "ins_record", "ins_search_chunks", "ins_search_faq",
    "ins_set_api_key", "ins_set_channel_auth", "ins_sweep_followups",
    # the studio job queue
    "claim_next_job", "cost_spent_in_month", "requeue_running_jobs",
]

BUCKETS = """
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('assets',         'assets',         false, null,     null),
  ('content-media',  'content-media',  false, 10485760, array['image/png','image/jpeg','image/webp']),
  ('content-people', 'content-people', false, 5242880,  array['image/png','image/jpeg','image/webp']),
  ('insurance-docs', 'insurance-docs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
"""

HEADER = """-- advisortool on UnitClub: every table, view and function it owned on DATA2.0, as they
-- stood on 2026-09-27, rebuilt from pg_dump by scripts/unitclub/build-baseline.py.
-- The migrations dated before this file describe DATA2.0's history and are not replayed here.

create extension if not exists vector with schema extensions;
create extension if not exists pgroonga with schema extensions;
"""

LOCKDOWN = """
-- UnitClub's default privileges hand every new table and function in public to anon and
-- authenticated, which here are UnitOS's tenant keys. None of these is theirs to reach.
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'S')
      and (c.relname like 'ins\\_%' or c.relname like 'v\\_ins\\_%'
           or c.relname = any (array['model_configs', 'projects', 'assets', 'brand_kits', 'jobs',
                                     'job_step_cache', 'cost_entries', 'settings']))
  loop
    execute format('revoke all on %s from anon, authenticated', r.rel);
  end loop;
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'ins\\_%'
           or p.proname = any (array['claim_next_job', 'cost_spent_in_month', 'requeue_running_jobs']))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;
"""


def statements(text: str) -> list[str]:
    """pg_dump output split into statements: blank-line separated, comments and psql meta lines gone."""
    lines = [l for l in text.splitlines() if not l.startswith("--") and not l.startswith("\\")]
    blocks, current = [], []
    in_body = False
    for line in lines:
        if "$$" in line and line.count("$$") % 2 == 1:
            in_body = not in_body
        if not line.strip() and not in_body:
            if current:
                blocks.append("\n".join(current))
                current = []
            continue
        current.append(line)
    if current:
        blocks.append("\n".join(current))
    return blocks


ANON_GRANT = re.compile(r'^(GRANT|REVOKE) .* (TO|FROM) "(anon|authenticated)";$')


def without_anon_grants(stmt: str) -> str:
    """pg_dump writes a relation's grants as consecutive one-line statements in one block."""
    return "\n".join(l for l in stmt.split("\n") if not ANON_GRANT.match(l))


def keep(stmt: str) -> bool:
    if not stmt.strip():
        return False
    if stmt.startswith(("SET ", "SELECT pg_catalog.set_config")):
        return False
    if stmt.startswith('CREATE POLICY "model_configs_read"'):
        return False
    if '"ins_line_events_created_idx"' in stmt:
        return False
    return True


def requalify(stmt: str) -> str:
    stmt = stmt.replace('"public"."vector_cosine_ops"', '"extensions"."vector_cosine_ops"')
    stmt = stmt.replace('"public"."vector"', '"extensions"."vector"')
    if '"public"."ins_search_chunks"(' in stmt and stmt.startswith("CREATE"):
        stmt = stmt.replace('SET "search_path" TO \'public\'\n', 'SET "search_path" TO \'public\', \'extensions\'\n', 1)
    return stmt


def function_statements(public_dump: str) -> list[str]:
    names = "|".join(FUNCTIONS)
    pattern = re.compile(rf'^(CREATE (OR REPLACE )?FUNCTION|ALTER FUNCTION|GRANT .* ON FUNCTION|REVOKE .* ON FUNCTION) "public"\."({names})"\(')
    return [s for s in statements(public_dump) if pattern.match(s) or pattern.search(s.split("\n", 1)[0])]


def main() -> None:
    relations = open(sys.argv[1], encoding="utf-8").read()
    public = open(sys.argv[2], encoding="utf-8").read()
    rel_stmts = [s for s in map(without_anon_grants, statements(relations)) if keep(s)]
    fn_stmts = [s for s in map(without_anon_grants, function_statements(public)) if keep(s)]
    # Tables, then functions (claim_next_job returns SETOF jobs, and SQL bodies are checked
    # against the tables when created), then the views with their owners and grants.
    views = [s for s in rel_stmts if '"public"."v_ins_' in s]
    tables = [s for s in rel_stmts if s not in views]
    out = [HEADER, BUCKETS]
    out += [requalify(s) + "\n" for s in tables]
    out += [requalify(s) + "\n" for s in fn_stmts]
    out += [requalify(s) + "\n" for s in views]
    out.append(LOCKDOWN)
    sys.stdout.write("\n".join(out))


if __name__ == "__main__":
    main()
