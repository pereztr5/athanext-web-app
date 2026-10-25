#!/usr/bin/env bash
# Applies one migration to the app's Supabase project and makes sure the API sees it:
#
#   scripts/apply-migration.sh backend/supabase/migrations/20261029100000_camp_athletes_without_account.sql
#   scripts/apply-migration.sh --check backend/supabase/migrations/<file>.sql   (step 3 only, read-only)
#
# 1. Runs the file and records it in supabase_migrations.schema_migrations (version = the
#    filename prefix, name = the rest) in ONE transaction with ON_ERROR_STOP: any error rolls
#    everything back and nothing is recorded. A version that is already recorded is refused.
# 2. Commits, then `notify pgrst, 'reload schema'` so PostgREST reloads its schema cache. Without
#    it the API can keep answering with the old schema ("column ... does not exist") even though
#    the database has the change: that is how the camp follow-up emails failed.
# 3. Waits 3s and checks the API with the service key: GET /rest/v1/ (Accept-Profile: public)
#    must answer 200, and every function and column the migration adds must be in the API's
#    schema. Retries the reload a few times, then exits 1 saying what the API is missing.
#
# Needs: psql (libpq), the CLI linked to the project (backend/supabase/.temp/pooler-url),
# SUPABASE_DB_PASSWORD (env, else .claude/settings.local.json env), and the service key
# (SUPABASE_SERVICE_ROLE_KEY, else read with `supabase projects api-keys`). Secrets are never printed.
# The file itself must not contain begin/commit (the script owns the transaction).
set -euo pipefail

PROJECT_REF="znrdabzydvulagmlepxr"
API_URL="https://$PROJECT_REF.supabase.co"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRIES=5

usage() { sed -n 2,20p "$0" | sed 's/^# \{0,1\}//'; exit 1; }

CHECK_ONLY=0
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=1
  shift
fi
[ $# -eq 1 ] || usage
case "$1" in -h|--help) usage ;; esac

FILE="$1"
[ -f "$FILE" ] || FILE="$ROOT/$1"
[ -f "$FILE" ] || { echo "No such migration: $1"; exit 1; }
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
BASE="$(basename "$FILE" .sql)"
VERSION="${BASE%%_*}"
NAME="${BASE#*_}"
[[ "$VERSION" =~ ^[0-9]{14}$ ]] && [ "$NAME" != "$BASE" ] || {
  echo "Name the file <14-digit version>_<name>.sql, like 20261029100000_camp_athletes.sql"
  exit 1
}

PSQL="$(command -v psql || true)"
[ -n "$PSQL" ] || PSQL=/usr/local/opt/libpq/bin/psql
[ -x "$PSQL" ] || { echo "psql not found (brew install libpq)"; exit 1; }
POOLER_FILE="$ROOT/backend/supabase/.temp/pooler-url"
[ -f "$POOLER_FILE" ] || { echo "Missing $POOLER_FILE: run 'supabase link --project-ref $PROJECT_REF' in backend/"; exit 1; }

if [ -z "${SUPABASE_DB_PASSWORD:-}" ] && [ -f "$ROOT/.claude/settings.local.json" ]; then
  SUPABASE_DB_PASSWORD="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("env", {}).get("SUPABASE_DB_PASSWORD", ""))' "$ROOT/.claude/settings.local.json")"
fi
[ -n "${SUPABASE_DB_PASSWORD:-}" ] || { echo "Set SUPABASE_DB_PASSWORD"; exit 1; }
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
DB_URL="$(cat "$POOLER_FILE")"

db() { "$PSQL" "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  SUPABASE_SERVICE_ROLE_KEY="$(cd "$ROOT/backend" && supabase projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null |
    python3 -c 'import json,sys; print(next((k.get("api_key","") for k in json.load(sys.stdin) if k.get("name") == "service_role"), ""))' || true)"
fi
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || { echo "Set SUPABASE_SERVICE_ROLE_KEY (or log in the Supabase CLI)"; exit 1; }

# ---------------------------------------------------------------- apply
if [ "$CHECK_ONLY" = 0 ]; then
  if grep -Eiq '^[[:space:]]*(begin|commit|start[[:space:]]+transaction)[[:space:]]*(transaction|work)?[[:space:]]*;' "$FILE"; then
    echo "$BASE has its own begin/commit; remove them (this script runs the file in one transaction)."
    exit 1
  fi
  if [ "$(db -Atc "select count(*) from supabase_migrations.schema_migrations where version = '$VERSION'")" != "0" ]; then
    echo "$VERSION is already recorded as applied. Nothing done."
    exit 1
  fi

  WRAPPER="$(mktemp)"
  trap 'rm -f "$WRAPPER"' EXIT
  # psql runs the file, then records it; --single-transaction wraps both in one BEGIN/COMMIT.
  printf "\\i '%s'\n" "${FILE//\'/\'\'}" >"$WRAPPER"
  cat >>"$WRAPPER" <<'SQL'
insert into supabase_migrations.schema_migrations (version, name, statements)
values (:'version', :'name', array[:'body']);
SQL
  echo "Applying $BASE in one transaction..."
  db --single-transaction \
    -v version="$VERSION" -v name="$NAME" -v body="$(cat "$FILE")" \
    -f "$WRAPPER"
  echo "Applied and recorded $VERSION ($NAME)."
fi

# ---------------------------------------------------------------- API check
# Functions (not trigger functions) and columns this migration adds, to look for in the API schema.
FUNCS="$(grep -Eio 'function[[:space:]]+public\.[a-z_][a-z0-9_]*' "$FILE" | sed -E 's/.*public\.//' | tr 'A-Z' 'a-z' | sort -u | tr '\n' ' ')"
if [ -n "$FUNCS" ]; then
  LIST="$(printf "'%s'," $FUNCS)"
  FUNCS="$(db -Atc "select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (${LIST%,}) and p.prorettype <> 'trigger'::regtype order by 1" | tr '\n' ' ')"
fi
COLS="$(grep -Eio 'add[[:space:]]+column[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?[a-z_][a-z0-9_]*' "$FILE" |
  awk '{print tolower($NF)}' | sort -u | tr '\n' ' ')"

BODY="$(mktemp)"
trap 'rm -f "${WRAPPER:-}" "$BODY"' EXIT
missing=""
for try in $(seq 1 "$TRIES"); do
  [ "$CHECK_ONLY" = 1 ] || db -c "notify pgrst, 'reload schema';"
  sleep 3
  code="$(curl -s -o "$BODY" -w '%{http_code}' "$API_URL/rest/v1/" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Accept-Profile: public" -H "Accept: application/openapi+json" || true)"
  missing=""
  if [ "$code" != "200" ]; then
    missing="the API itself (GET /rest/v1/ answered $code)"
  else
    for f in $FUNCS; do grep -q "\"/rpc/$f\"" "$BODY" || missing="$missing function $f"; done
    for c in $COLS; do grep -q "\"$c\"" "$BODY" || missing="$missing column $c"; done
  fi
  [ -z "$missing" ] && break
  echo "Try $try of $TRIES: the API doesn't see$missing yet."
done

if [ -n "$missing" ]; then
  [ "$CHECK_ONLY" = 1 ] && { echo "The API doesn't see$missing."; exit 1; }
  echo "The API still doesn't see$missing. The database has the change; run"
  echo "  notify pgrst, 'reload schema';"
  echo "again, or restart the API in the Supabase dashboard, before shipping code that uses it."
  exit 1
fi
echo "API OK: it sees ${FUNCS:+functions $FUNCS}${COLS:+columns $COLS}(GET /rest/v1/ 200)."
