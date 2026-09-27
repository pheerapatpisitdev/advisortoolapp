# Move advisortool's data to UnitClub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything advisortool keeps in Supabase moves from DATA2.0 (`tmbbxahyxwkshxuxphcb`) to UnitClub (`cenysylrzbwfrtuqoeqk`), with no change to how the app behaves.

**Architecture:** A baseline migration rebuilds advisortool's tables, views and functions on UnitClub, locked to `service_role` so UnitOS's tenant keys (role `anon`) cannot reach them. Rows move with `pg_dump --data-only | psql` in one transaction; files move bucket by bucket through the Storage API. The app switches over by changing two env vars on Vercel. The encrypted columns keep working because their key is `ADMIN_SESSION_SECRET`, which does not change.

**Tech Stack:** Supabase (Postgres 17, pg_cron, pg_net, pgvector, PGroonga), Supabase CLI 2.105 (for a temporary login role), pg_dump/psql 18, Node + supabase-js, Next.js on Vercel.

This is plan 1 of 2. Plan 2 (UnitOS sign-in, staff permissions, per-agent Studio quota, `tenant_id`/`agent_id` on the Studio tables) is written after this one lands, against the moved schema.

**What moves:** every `public.ins_*` table and sequence, the four `v_ins_*` views, the 20 `ins_*` functions, `model_configs` (Maryjane is gone, so advisortool owns its copy now), the studio job tables (`projects`, `assets`, `brand_kits`, `jobs`, `job_step_cache`, `cost_entries`, `settings`) with their three functions, the buckets `assets`, `content-media`, `content-people`, `insurance-docs`, and the two cron jobs `ins_prune_hourly` and `messenger-followups`.

**What does not move:** Maryjane's tables and functions, Organizational Chart (`org_charts`, `org-chart-photos`), `auth.users`. DATA2.0 stays up for Organizational Chart.

**Checked beforehand (2026-09-27):** no foreign key or trigger links these tables to anything left behind; UnitClub has no table, bucket or cron job with any of these names; no row stores the old project's host name; `vector` and `pgroonga` are available on UnitClub.

---

### Task 1: Tooling

**Files:**
- Create: `scripts/unitclub/relations.txt` — the `pg_dump -t` patterns for everything that moves
- Create: `scripts/unitclub/pg-env.sh` — borrows the CLI's temporary login role for a project
- Create: `scripts/unitclub/build-baseline.py` — turns two schema dumps into the baseline migration
- Create: `scripts/unitclub/copy-data.sh` — empties the target tables and copies every row in one transaction
- Create: `scripts/unitclub/copy-storage.mjs` — copies the four buckets file by file
- Create: `scripts/unitclub/check-secrets.mjs` — decrypts every AI key and channel token on the target

- [ ] **Step 1:** Write the six files (as committed on branch `move-to-unitclub`).
- [ ] **Step 2:** `chmod +x scripts/unitclub/*.sh scripts/unitclub/*.py`
- [ ] **Step 3:** Commit: `git add scripts/unitclub docs/superpowers/plans/2026-09-27-move-to-unitclub.md && git commit -m "chore(unitclub): tooling to move the database"`

### Task 2: Baseline migration

**Files:**
- Create: `supabase/migrations/20260927_unitclub_baseline.sql`

- [ ] **Step 1: Dump the schema from DATA2.0**

```bash
eval "$(scripts/unitclub/pg-env.sh tmbbxahyxwkshxuxphcb SRC)"
args=(); while read -r r; do [ -n "$r" ] && args+=(-t "$r"); done < scripts/unitclub/relations.txt
export PGHOST=$SRC_PGHOST PGPORT=$SRC_PGPORT PGUSER=$SRC_PGUSER PGPASSWORD=$SRC_PGPASSWORD PGDATABASE=$SRC_PGDATABASE
pg_dump --schema-only --quote-all-identifiers --role=postgres "${args[@]}" > "$TMPDIR/relations.sql"
pg_dump --schema-only --quote-all-identifiers --role=postgres --schema=public > "$TMPDIR/public.sql"
```

- [ ] **Step 2: Build the migration**

```bash
python3 scripts/unitclub/build-baseline.py "$TMPDIR/relations.sql" "$TMPDIR/public.sql" > supabase/migrations/20260927_unitclub_baseline.sql
grep -c '^CREATE TABLE' supabase/migrations/20260927_unitclub_baseline.sql   # expect 42 (34 ins_* + model_configs + 7 studio)
grep -c 'FUNCTION "public"' supabase/migrations/20260927_unitclub_baseline.sql
grep -n '"anon"\|"authenticated"\|"public"."vector"' supabase/migrations/20260927_unitclub_baseline.sql   # expect nothing
grep -n 'REFERENCES' supabase/migrations/20260927_unitclub_baseline.sql   # every target must be in the file
```

- [ ] **Step 3: Commit** — `git add supabase/migrations/20260927_unitclub_baseline.sql && git commit -m "chore(unitclub): baseline migration built from DATA2.0"`

### Task 3: Apply the baseline to UnitClub

Additive only: new extensions, tables, functions, views and four buckets. Nothing of UnitOS's is touched.

- [ ] **Step 1:** Apply the file with the Supabase MCP `apply_migration` (project `cenysylrzbwfrtuqoeqk`, name `advisortool_baseline`).
- [ ] **Step 2: Verify the shape and the lock**

```sql
select count(*) filter (where c.relkind = 'r') as tables, count(*) filter (where c.relkind = 'v') as views
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and (c.relname like 'ins\_%' or c.relname like 'v\_ins\_%');
-- expect 34 tables, 4 views

select count(*) from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and (table_name like 'ins\_%' or table_name like 'v\_ins\_%' or table_name in ('model_configs','projects','assets','brand_kits','jobs','job_step_cache','cost_entries','settings'));
-- expect 0

select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and (p.proname like 'ins\_%' or p.proname in ('claim_next_job','cost_spent_in_month','requeue_running_jobs'))
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
-- expect no rows
```

- [ ] **Step 3:** Run `get_advisors` (security) on UnitClub. Expected new findings: only "RLS enabled, no policy" INFO for the moved tables. Anything else is fixed before going on.

### Task 4: Rehearsal copy

Copies today's rows and files while DATA2.0 keeps serving the app. The cutover repeats it.

- [ ] **Step 1: Rows**

```bash
eval "$(scripts/unitclub/pg-env.sh tmbbxahyxwkshxuxphcb SRC)"
eval "$(scripts/unitclub/pg-env.sh cenysylrzbwfrtuqoeqk DST)"
scripts/unitclub/copy-data.sh     # expect: copied
```

- [ ] **Step 2: Files**

```bash
key() { supabase projects api-keys --project-ref "$1" -o json | jq -r '.[] | select(.name=="service_role") | .api_key'; }
SRC_URL=https://tmbbxahyxwkshxuxphcb.supabase.co SRC_SERVICE_KEY="$(key tmbbxahyxwkshxuxphcb)" \
DST_URL=https://cenysylrzbwfrtuqoeqk.supabase.co DST_SERVICE_KEY="$(key cenysylrzbwfrtuqoeqk)" \
node scripts/unitclub/copy-storage.mjs
# expect: assets 2/2, content-media 51/51, content-people 24/24, insurance-docs 3/3 (or today's counts)
```

- [ ] **Step 3: Row counts match** — run on both projects and compare:

```sql
select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int as n
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and (c.relname like 'ins\_%' or c.relname in ('model_configs','projects','assets','brand_kits','jobs','job_step_cache','cost_entries','settings'))
order by 1;
```

- [ ] **Step 4: Encrypted columns open on the target**

```bash
URL=https://cenysylrzbwfrtuqoeqk.supabase.co SERVICE_KEY="$(key cenysylrzbwfrtuqoeqk)" \
ADMIN_SESSION_SECRET="$(grep '^ADMIN_SESSION_SECRET=' .env.local | cut -d= -f2-)" \
node scripts/unitclub/check-secrets.mjs
# expect ✓ for 5 AI keys and 7 channel tokens
```

- [ ] **Step 5: Search works** — on UnitClub: `select count(*) from public.ins_search_faq((select embedding from public.ins_faq where embedding is not null limit 1), 3);` returns rows, and `select count(*) from public.ins_doc_chunks where content &@~ 'ประกัน';` runs without error (with `set search_path = public, extensions`).

### Task 5: The app against UnitClub, locally

- [ ] **Step 1:** `NEXT_PUBLIC_SUPABASE_URL=https://cenysylrzbwfrtuqoeqk.supabase.co SUPABASE_SERVICE_ROLE_KEY="$(key cenysylrzbwfrtuqoeqk)" npm run dev` — the variables on the command line win over `.env.local`, which is not edited.
- [ ] **Step 2:** Open `/admin`, `/admin/ai`, `/admin/crm`, `/admin/knowledge`, `/studio`, `/studio/calendar`, `/plan`. Each loads with the same numbers as production. Do not press anything that posts to a Page or sends a message.
- [ ] **Step 3:** `npm run verify` passes on the branch.

### Task 6: Cutover (owner picks a quiet time; about 10 minutes)

- [ ] **Step 1: Stop the jobs on DATA2.0** (MCP `apply_migration`, project `tmbbxahyxwkshxuxphcb`, name `stop_advisortool_crons`):

```sql
select cron.unschedule('messenger-followups');
select cron.unschedule('ins_prune_hourly');
```

- [ ] **Step 2:** Repeat Task 4 Steps 1–3 (rows, files, counts).
- [ ] **Step 3:** On Vercel (production and preview) set `NEXT_PUBLIC_SUPABASE_URL=https://cenysylrzbwfrtuqoeqk.supabase.co` and `SUPABASE_SERVICE_ROLE_KEY` to UnitClub's service key. Leave `ADMIN_SESSION_SECRET` exactly as it is. Redeploy production (the URL is baked in at build time).
- [ ] **Step 4: Start the jobs on UnitClub** (MCP `apply_migration`, project `cenysylrzbwfrtuqoeqk`, name `advisortool_crons`):

```sql
select cron.schedule('ins_prune_hourly', '5 * * * *', 'select public.ins_prune()');
select cron.schedule('messenger-followups', '* * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/facebook/followups',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);
```

- [ ] **Step 5: Verify:** `/api/health` answers; after two minutes `cron.job_run_details` on UnitClub shows both jobs succeeded and `net._http_response` shows 200s; a test message to the Page gets an answer and appears in `ins_transcripts` on UnitClub; UnitClub's API logs show advisortool's requests and DATA2.0's show none.
- [ ] **Step 6:** Point `.env.local` at UnitClub (same two variables).

**Rollback, any time before DATA2.0 is cleaned:** set the two Vercel variables back, redeploy, re-schedule the two jobs on DATA2.0 and unschedule them on UnitClub. Rows written on UnitClub after the cutover would need copying back by hand.

### Task 7: Afterwards (one to two weeks later, separate go-ahead)

- [ ] Export, then drop, advisortool's tables, functions, buckets and Maryjane's leftovers from DATA2.0, keeping Organizational Chart's.
- [ ] Merge `move-to-unitclub` into `main`.
