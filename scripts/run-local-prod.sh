#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SKIP_BUILD="false"
USE_PM2="false"

for ARG in "$@"; do
  case "$ARG" in
    --skip-build)
      SKIP_BUILD="true"
      ;;
    --pm2)
      USE_PM2="true"
      ;;
    *)
      echo "Unknown option: $ARG"
      echo "Usage: bash scripts/run-local-prod.sh [--skip-build] [--pm2]"
      exit 1
      ;;
  esac
done

if [[ "$SKIP_BUILD" != "true" ]]; then
  npm run build
fi

if [[ "$USE_PM2" == "true" ]]; then
  npm run pm2:start
else
  npm run start
fi
