#!/usr/bin/env bash
# Deploys Supabase edge functions to the app's project with the exact names and JWT
# settings the app uses. Run from anywhere:
#
#   scripts/deploy-functions.sh create-booking-payment coach-billing
#   scripts/deploy-functions.sh --all
#   scripts/deploy-functions.sh --list
#
# The table below is the source of truth. "folder" is the code in
# backend/supabase/functions, "name" is what the app calls, "jwt" is whether Supabase
# checks the caller's login before the function runs (functions that receive Stripe,
# Shopify or Google callbacks check the caller themselves, so jwt=off).
set -euo pipefail

PROJECT_REF="znrdabzydvulagmlepxr"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_DIR="$ROOT/backend/supabase"

# folder                      name                          jwt
FUNCTIONS="
add-client-referral           add-client-referral           on
admin-accounts                admin-accounts                on
coach-billing                 coach-billing                 off
coach-invoices                coach-invoices                on
create-booking-payment        create-booking-payment-v0     off
create-package-payment        create-package-payment        on
create-partnership-payment    create-partnership-payment    on
google-calendar               google-calendar               off
guardian-invite               guardian-invite               on
org-coach-removal             org-coach-removal             on
organization-email            organization-email            on
reconcile-package-payment     reconcile-package-payment     on
send-booking-notifications    send-booking-notifications    on
send-conversation-email       send-conversation-email       on
send-email                    send-email                    on
shopify-orders                shopify-orders                off
stripe-payouts                stripe-payouts                on
submit-sports-vote            submit-sports-vote            off
validate-email                validate-email                on
"

usage() { sed -n 2,13p "$0" | sed 's/^# \{0,1\}//'; exit 1; }

row_for() { echo "$FUNCTIONS" | awk -v f="$1" '$1==f || $2==f {print; exit}'; }

deploy_one() {
  local row folder name jwt flags workdir
  row="$(row_for "$1")"
  [ -n "$row" ] || { echo "Unknown function: $1 (see --list)"; exit 1; }
  read -r folder name jwt <<<"$row"
  [ -f "$SUPABASE_DIR/functions/$folder/index.ts" ] || { echo "Missing $SUPABASE_DIR/functions/$folder/index.ts"; exit 1; }
  flags=(--project-ref "$PROJECT_REF" --use-api)
  [ "$jwt" = "off" ] && flags+=(--no-verify-jwt)

  if [ "$folder" = "$name" ]; then
    (cd "$ROOT/backend" && supabase functions deploy "$name" "${flags[@]}")
  else
    # Deployed under another name: copy the folder into a throwaway project dir with that name.
    workdir="$(mktemp -d)"
    trap 'rm -rf "$workdir"' RETURN
    mkdir -p "$workdir/supabase/functions"
    cp "$SUPABASE_DIR/config.toml" "$workdir/supabase/config.toml"
    cp -R "$SUPABASE_DIR/functions/$folder" "$workdir/supabase/functions/$name"
    [ -d "$SUPABASE_DIR/functions/_shared" ] && cp -R "$SUPABASE_DIR/functions/_shared" "$workdir/supabase/functions/_shared"
    (cd "$workdir" && supabase functions deploy "$name" "${flags[@]}")
  fi
  echo "Deployed $folder as $name (jwt $jwt)"
}

[ $# -gt 0 ] || usage
case "$1" in
  --list) echo "$FUNCTIONS" | awk 'NF {printf "%-28s -> %-28s jwt %s\n", $1, $2, $3}' ;;
  --all) for f in $(echo "$FUNCTIONS" | awk 'NF {print $1}'); do deploy_one "$f"; done ;;
  -h|--help) usage ;;
  *) for f in "$@"; do deploy_one "$f"; done ;;
esac
