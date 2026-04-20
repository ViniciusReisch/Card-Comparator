#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Installing Linux runtime dependencies..."
sudo apt-get update
sudo apt-get install -y curl git build-essential ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2 globally..."
  sudo npm install -g pm2
fi

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review it before exposing the app publicly."
fi

npm ci
npx playwright install --with-deps chromium
npm run build
npm run pm2:start

pm2 save

echo "Bootstrap complete. App target: http://localhost:${PORT:-3333}"
