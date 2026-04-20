# Operacao local continua

Este guia mantem a aplicacao rodando no seu PC enquanto ele estiver ligado.

## 1. Instalar dependencias

```bash
npm install
npm run playwright:install
```

## 2. Configurar ambiente

Crie `.env` a partir de `.env.example`.

Campos principais:

```env
PORT=3333
VITE_API_URL=
ENABLE_BACKGROUND_SCHEDULER=true
MONITOR_INTERVAL_MINUTES=10
RUN_ON_BOOT=true
```

- `VITE_API_URL=` vazio faz o frontend chamar a API na mesma origem. Isso e o modo indicado para producao local e Cloudflare Tunnel.
- Em desenvolvimento com `npm run dev`, o Vite usa proxy para `/api`.
- `ENABLE_BACKGROUND_SCHEDULER=false` desliga o agendador interno.
- `MONITOR_INTERVAL_MINUTES=10` define o intervalo recorrente.
- `RUN_ON_BOOT=true` inicia uma coleta assim que a API sobe.

## 3. Rodar em desenvolvimento

```bash
npm run dev
```

- Frontend Vite: `http://localhost:5173`
- API Express: `http://localhost:3333`

## 4. Rodar em producao local

```bash
npm run build
npm run start
```

Ou em um unico comando:

```bash
npm run prod:serve
```

URL local:

```text
http://localhost:3333
```

No modo de producao local, o Express serve a API e o build do React na mesma porta.

## 5. Deixar rodando com PM2

```bash
npm run build
npm run pm2:start
```

Comandos uteis:

```bash
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

O processo PM2 se chama `pokemon-rayquaza-monitor`.

## 6. Scripts auxiliares

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-local-prod.ps1
powershell -ExecutionPolicy Bypass -File scripts/run-local-prod.ps1 -UsePm2
```

Linux/macOS:

```bash
bash scripts/run-local-prod.sh
bash scripts/run-local-prod.sh --pm2
```

## 7. Status e controle do monitor

Health:

```http
GET http://localhost:3333/api/health
```

Status completo:

```http
GET http://localhost:3333/api/monitor/status
```

Executar agora:

```http
POST http://localhost:3333/api/monitor/run
```

Pausar e retomar o agendador:

```http
POST http://localhost:3333/api/monitor/pause
POST http://localhost:3333/api/monitor/resume
```

O endpoint de status mostra `schedulerEnabled`, `isRunning`, `startedAt`, `finishedAt`, `lastRunStartedAt`, `lastRunFinishedAt` e `nextRunAt`.
