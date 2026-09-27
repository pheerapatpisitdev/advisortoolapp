#!/usr/bin/env bash
# Copy advisortool's rows from DATA2.0 into UnitClub, replacing whatever UnitClub holds.
#
#   eval "$(scripts/unitclub/pg-env.sh tmbbxahyxwkshxuxphcb SRC)"
#   eval "$(scripts/unitclub/pg-env.sh cenysylrzbwfrtuqoeqk DST)"
#   scripts/unitclub/copy-data.sh
#
# Safe to run again: the target tables are emptied first, and the whole copy is one
# transaction on the target — it lands complete or not at all. The source is only read.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

args=()
while read -r rel; do [ -n "$rel" ] && args+=(-t "$rel"); done < "$here/relations.txt"

src() { PGHOST="$SRC_PGHOST" PGPORT="$SRC_PGPORT" PGUSER="$SRC_PGUSER" PGPASSWORD="$SRC_PGPASSWORD" PGDATABASE="$SRC_PGDATABASE" "$@"; }
dst() { PGHOST="$DST_PGHOST" PGPORT="$DST_PGPORT" PGUSER="$DST_PGUSER" PGPASSWORD="$DST_PGPASSWORD" PGDATABASE="$DST_PGDATABASE" "$@"; }

{
  echo "set role postgres;"
  # ins_content and ins_hook_templates point at each other (20260927_unitclub_deferrable_hook_fks.sql)
  echo "set constraints all deferred;"
  # empty every table the copy is about to fill; views and sequences need nothing
  cat <<'SQL'
do $$
declare t text;
begin
  select string_agg(c.oid::regclass::text, ', ') into t
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (c.relname like 'ins\_%'
         or c.relname = any (array['model_configs', 'projects', 'assets', 'brand_kits', 'jobs',
                                   'job_step_cache', 'cost_entries', 'settings']));
  execute 'truncate table ' || t || ' restart identity';
end $$;
SQL
  src pg_dump --data-only --no-owner --no-privileges --role=postgres "${args[@]}"
} | dst psql -v ON_ERROR_STOP=1 --single-transaction -q -X

echo "copied"
