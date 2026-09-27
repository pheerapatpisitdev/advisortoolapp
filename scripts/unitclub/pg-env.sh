#!/usr/bin/env bash
# Borrow the Supabase CLI's temporary login role for one project and print it as
# <PREFIX>_PGHOST / _PGPORT / _PGUSER / _PGPASSWORD / _PGDATABASE exports.
#
#   eval "$(scripts/unitclub/pg-env.sh tmbbxahyxwkshxuxphcb SRC)"
#   eval "$(scripts/unitclub/pg-env.sh cenysylrzbwfrtuqoeqk DST)"
#
# Needs `supabase login` once; no database password is asked for or stored. The password
# is short-lived and only ever lives in the calling shell — never echo it.
set -euo pipefail
ref="$1"; prefix="$2"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
cd "$work"
supabase init --yes >/dev/null 2>&1
supabase link --project-ref "$ref" --yes >/dev/null 2>&1
supabase db dump --linked --dry-run 2>/dev/null | grep -E '^export PG' | sed -E "s/^export PG/export ${prefix}_PG/"
