#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f ".env.example" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.example"
  set +a
fi

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

BIN="${CLOUDFLARED_BIN:-cloudflared}"
TARGET="${CLOUDFLARE_TUNNEL_TARGET:-http://localhost:3333}"
HOSTNAME="${CLOUDFLARE_TUNNEL_HOSTNAME:-}"
RUN_QUICK_TUNNEL="false"

if [[ "${1:-}" == "--run-quick-tunnel" ]]; then
  RUN_QUICK_TUNNEL="true"
fi

echo "Cloudflare Tunnel target: $TARGET"
if [[ -n "$HOSTNAME" ]]; then
  echo "Configured hostname: $HOSTNAME"
fi

if ! command -v "$BIN" >/dev/null 2>&1; then
  echo "cloudflared was not found as '$BIN'."
  echo "Install cloudflared first, then run this script again."
  echo "Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  if [[ "$RUN_QUICK_TUNNEL" == "true" ]]; then
    exit 1
  fi
  exit 0
fi

if [[ "$RUN_QUICK_TUNNEL" == "true" ]]; then
  echo "Starting a temporary TryCloudflare tunnel..."
  exec "$BIN" tunnel --url "$TARGET"
fi

echo ""
echo "Quick tunnel for testing:"
echo "  bash scripts/setup-cloudflared.sh --run-quick-tunnel"
echo ""
echo "Named tunnel for a fixed public hostname:"
echo "  $BIN tunnel login"
echo "  $BIN tunnel create pokemon-rayquaza-monitor"
if [[ -n "$HOSTNAME" ]]; then
  echo "  $BIN tunnel route dns pokemon-rayquaza-monitor $HOSTNAME"
else
  echo "  $BIN tunnel route dns pokemon-rayquaza-monitor <seu-dominio>"
fi
echo "  $BIN tunnel run pokemon-rayquaza-monitor"
