# Rayquaza Monitor — Relatório de Segurança Beta de Produção

Branch: `release/prod-beta-safe`  
Data: 2026-04-27

---

## Funcionalidades mantidas na beta

- Scraping manual (todas as 3 fontes): Liga Pokémon, CardTrader, MYP Cards
- Seleção de fontes por run (SourceSelector)
- Fila de pending run (execução aguarda a atual terminar)
- Dashboard com stats, distribuições e últimos anúncios
- Visualização de ofertas, cards e histórico de execuções
- Notificações (ntfy, Telegram) — envio de teste permitido
- Endpoint `/api/config` expondo flags seguras ao frontend
- Servir frontend estático em produção via Express
- Health check `/api/health`

---

## Funcionalidades desabilitadas somente em produção beta

| Funcionalidade | Flag | Motivo |
|---|---|---|
| Scheduler automático | `ENABLE_SCHEDULER=false` | Evita runs não intencionais em ambiente não supervisionado |
| Modo beta seguro (bloqueia pause/resume) | `ENABLE_BETA_SAFE_MODE=true` | Scheduler não existe em prod beta; botões seriam no-op perigosos |
| Ações de admin perigosas | `ENABLE_ADMIN_DANGEROUS_ACTIONS=false` | Impede operações destrutivas enquanto em validação |
| Run automática no boot | `RUN_ON_BOOT=false` | Scraping não deve iniciar sem supervisão humana |

---

## Arquivos alterados

- `src/config/env.ts` — 4 novas flags: `ENABLE_SCHEDULER`, `ENABLE_BETA_SAFE_MODE`, `ENABLE_ADMIN_DANGEROUS_ACTIONS`, `ENABLE_WHEELZ_SCRAPER`
- `src/api/server.ts` — import de `configRouter`, gate de scheduler, middleware de proteção beta
- `src/api/routes/config.routes.ts` — **criado** — endpoint `/api/config`
- `src/api/routes/monitor.routes.ts` — extrai `sources` do body no POST /run
- `src/services/monitor-scheduler.service.ts` — guard `ENABLE_SCHEDULER` no `start()`
- `src/services/monitor.service.ts` — filtragem de fontes + pending run
- `src/app/api/client.ts` — tipo `AppConfigResponse`, `getConfig()`, `runMonitor({ sources })`
- `src/app/hooks/useAppConfig.ts` — **criado** — hook de config do app
- `src/app/components/SourceSelector.tsx` — **criado** — seleção de lojas
- `src/app/pages/DashboardPage.tsx` — integração de config, SourceSelector, pendingRun, beta gates
- `src/app/components/Layout.tsx` — MYP Cards adicionado nas fontes da sidebar
- `ecosystem.config.js` — `env_production` expandido com feature flags beta
- `.env.production.example` — **criado** — template de .env para produção
- `scripts/deploy-vm.sh` — **criado** — script de deploy para VPS Linux
- `.env.example` — novas flags adicionadas ao final

---

## Feature flags criadas

| Flag | Default | Descrição |
|---|---|---|
| `ENABLE_SCHEDULER` | `true` | Liga/desliga o scheduler automático |
| `ENABLE_BETA_SAFE_MODE` | `false` | Ativa proteções de modo beta; bloqueia pause/resume |
| `ENABLE_ADMIN_DANGEROUS_ACTIONS` | `true` | Permite ações administrativas potencialmente destrutivas |
| `ENABLE_WHEELZ_SCRAPER` | `false` | Para integração futura com HWheelsHub (não ativo neste projeto) |

---

## Variáveis de ambiente necessárias em produção

Mínimas obrigatórias:
```
NODE_ENV=production
PORT=3333
DATABASE_PATH=./storage/monitor.sqlite
HEADLESS=true
ENABLE_SCHEDULER=false
ENABLE_BETA_SAFE_MODE=true
RUN_ON_BOOT=false
```

Opcionais mas recomendadas:
```
NTFY_ENABLED=true
NTFY_BASE_URL=https://ntfy.sh
NTFY_TOPIC=seu-topico
MYP_ENABLED=true
```

Ver `.env.production.example` para lista completa.

---

## Riscos ainda existentes

1. **Sem autenticação**: qualquer pessoa com acesso à URL pode disparar o monitor. Mitigação: usar Cloudflare Access ou manter a URL privada (não publicar o hostname do tunnel).
2. **SQLite em produção**: sem backup automático. Recomenda-se configurar cron de backup do `./storage/monitor.sqlite`.
3. **Playwright em VPS**: consumo de memória elevado durante scraping. `max_memory_restart: 1100M` no PM2 reinicia se exceder, mas uma run pode ser interrompida.
4. **Sem rate limiting na API**: endpoint `/api/monitor/run` pode ser abusado. Em beta supervisionado isso é aceitável, mas deve ser resolvido antes da abertura pública.
5. **Logs em disco**: PM2 escreve em `./storage/pm2-*.log` sem rotação configurada. Em produção longa, pode crescer indefinidamente.

---

## Próximos passos antes da produção oficial

- [ ] Adicionar autenticação (JWT ou Cloudflare Access)
- [ ] Rate limiting no endpoint `/api/monitor/run`
- [ ] Rotação de logs do PM2 (`pm2 install pm2-logrotate`)
- [ ] Backup automático do SQLite (cron diário)
- [ ] Habilitar scheduler com intervalo conservador (`ENABLE_SCHEDULER=true`, `MONITOR_INTERVAL_MINUTES=60`)
- [ ] Testes automatizados de integração dos scrapers
- [ ] Monitoramento de uptime externo (UptimeRobot ou similar)

---

## Instruções de deploy na VM (Hetzner CX23 / Ubuntu 24.04)

```bash
# 1. Pré-requisitos (Node.js 20+, PM2, git)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

# 2. Executar script de deploy
bash scripts/deploy-vm.sh

# 3. Configurar .env
cp .env.production.example .env
nano .env   # preencher variáveis necessárias

# 4. Reiniciar com configuração correta
pm2 restart pokemon-rayquaza-monitor --env production
pm2 save
pm2 startup  # configurar auto-start no boot
```

---

## Checklist de validação pós-deploy

- [ ] `curl http://localhost:3333/api/health` retorna `{"status":"ok"}`
- [ ] `curl http://localhost:3333/api/config` retorna `betaSafeMode: true`
- [ ] Dashboard carrega no browser
- [ ] Botões "Pausar/Retomar agendador" NÃO aparecem no dashboard (beta mode)
- [ ] SourceSelector aparece com as 3 fontes
- [ ] Clicar "Rodar monitoramento agora" inicia scraping
- [ ] `pm2 logs pokemon-rayquaza-monitor` mostra atividade
- [ ] SQLite criado em `./storage/monitor.sqlite`
- [ ] Notificações de teste funcionam (se configuradas)
