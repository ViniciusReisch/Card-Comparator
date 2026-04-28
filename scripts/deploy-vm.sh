#!/bin/bash
# Deploy script para Hetzner CX23 (Ubuntu 24.04)
# Uso: bash scripts/deploy-vm.sh
set -e

APP_DIR="/opt/rayquaza-monitor"
REPO_URL="https://github.com/ViniciusReisch/Card-Comparator.git"
BRANCH="release/prod-beta-safe"

echo "=== Deploy Rayquaza Monitor ==="

# Clonar ou atualizar repo
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout $BRANCH
  git pull origin $BRANCH
else
  git clone -b $BRANCH $REPO_URL $APP_DIR
  cd "$APP_DIR"
fi

# Instalar dependencias
npm ci --omit=dev

# Instalar Playwright Chromium
npx playwright install chromium --with-deps

# Criar storage dir
mkdir -p storage

# Verificar .env
if [ ! -f ".env" ]; then
  echo "ERRO: .env nao encontrado. Copie .env.production.example para .env e configure."
  exit 1
fi

# Inicializar banco
npm run db:init

# Build
npm run build

# PM2
pm2 delete pokemon-rayquaza-monitor 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

echo "=== Deploy concluido! ==="
echo "App rodando em http://localhost:3333"
