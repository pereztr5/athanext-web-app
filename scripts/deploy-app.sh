#!/usr/bin/env bash
# Deploys app.athanext.com (Vercel project athanext-staging) after the checks pass.
#
#   scripts/deploy-app.sh preview   any branch -> a private preview link for hand-testing
#   scripts/deploy-app.sh prod      main only, clean and pushed -> app.athanext.com
#
# Both run lint, type-check, unit tests, the build and the smoke tests first.
# Set SKIP_E2E=1 to skip the smoke tests (for example when no test accounts are set).
set -euo pipefail

TARGET="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

case "$TARGET" in
  preview|prod) ;;
  *) sed -n 2,8p "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

if [ "$TARGET" = "prod" ]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  [ "$branch" = "main" ] || { echo "Live deploys only from main (on $branch)."; exit 1; }
  [ -z "$(git status --porcelain -- "$ROOT/frontend" ':!.vercel')" ] || { echo "frontend/ has uncommitted changes."; exit 1; }
  git fetch -q origin main
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main is not the same as origin/main. Pull or push first."; exit 1; }
fi

echo "== lint";        npm run -s lint
echo "== type-check";  npm run -s type-check
echo "== unit tests";  npm run -s test
echo "== build";       npm run -s build
if [ "${SKIP_E2E:-0}" != "1" ]; then
  echo "== smoke tests"; npm run -s e2e
fi

if [ "$TARGET" = "prod" ]; then
  vercel deploy --prod
else
  vercel deploy
fi
