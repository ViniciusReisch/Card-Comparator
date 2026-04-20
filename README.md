# card-comparator - Rayquaza Monitor

Monitor local para acompanhar anuncios publicos de cards Rayquaza na Liga Pokemon e no CardTrader. O projeto entra no detalhe de cada card, salva todas as ofertas em SQLite, destaca novidades e mostra progresso do scraper em tempo real via SSE.

## Aviso de uso responsavel

Este projeto coleta apenas dados publicamente visiveis por navegacao normal.

- Nao burla captcha, login ou protecoes.
- Respeita delays configuraveis entre paginas e detalhes.
- Salva logs e screenshots quando algum card falha.
- Deve ser usado de forma responsavel e conforme os termos dos sites monitorados.

## Funcionalidades

- Coleta cards Rayquaza nas URLs configuradas para Liga Pokemon e CardTrader.
- Entra na pagina de detalhe de cada card para buscar lojas, vendedores e ofertas.
- Salva cards, ofertas, execucoes e historico de preco em SQLite.
- Detecta novos anuncios por `is_new` e `first_seen_run_id`.
- Prioriza cards novos na fila de scraping para encontrar novidades mais cedo.
- Atualiza a interface em tempo real durante a coleta via SSE.
- Mostra uma tela unica de `Anuncios`, com filtro `Novos anuncios` marcado por padrao.
- Insere novos anuncios na interface sem esperar o monitor terminar.
- Converte precos para BRL com cache diario de cambio.

## Stack

- Node.js
- TypeScript
- Playwright
- SQLite (`better-sqlite3`)
- Express
- Vite + React
- dotenv
- zod
- date-fns
- tsx
- concurrently

## Instalacao

```bash
npm install
npm run playwright:install
```

## Configuracao

Crie um `.env` a partir de `.env.example`.

```env
DATABASE_PATH=./storage/monitor.sqlite
HEADLESS=true
SLOW_MO=0
REQUEST_DELAY_MS=1500
LIGA_MAX_VER_MAIS_CLICKS=100
CARDTRADER_MAX_PAGES=200
MONITOR_STATUS_POLL_INTERVAL_MS=1500
DETAIL_CONCURRENCY=1
CARD_DETAIL_TIMEOUT_MS=20000
SCRAPER_FAST_MODE=false
PORT=3333
VITE_API_URL=
ENABLE_BACKGROUND_SCHEDULER=true
MONITOR_INTERVAL_MINUTES=10
RUN_ON_BOOT=true
ENABLE_REMOTE_ACCESS=true
REMOTE_ACCESS_MODE=cloudflare_tunnel
APP_PUBLIC_URL=
API_PUBLIC_URL=
CLOUDFLARED_BIN=cloudflared
CLOUDFLARE_TUNNEL_TARGET=http://localhost:3333
CLOUDFLARE_TUNNEL_HOSTNAME=
```

Use `VITE_API_URL=` vazio para producao local e Cloudflare Tunnel. Assim o frontend chama `/api` na mesma origem publica. No modo `npm run dev`, o Vite faz proxy de `/api` para `http://localhost:3333`.

## Inicializar o banco

```bash
npm run db:init
```

Cria o SQLite local, aplica o schema e migra colunas novas sem destruir dados antigos.

## Rodar o monitoramento

```bash
npm run monitor
```

Executa uma coleta unica. As ofertas novas sao persistidas imediatamente e aparecem na API/interface durante a execucao.

## Rodar a API e a interface

```bash
npm run dev
```

- API Express: `http://localhost:3333`
- Interface Vite/React: `http://localhost:5173`

## Rodar em producao local no PC

```bash
npm run build
npm run start
```

Ou:

```bash
npm run prod:serve
```

Em producao local, o Express serve backend e frontend na mesma porta:

```text
http://localhost:3333
```

Scripts auxiliares:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-local-prod.ps1
powershell -ExecutionPolicy Bypass -File scripts/run-local-prod.ps1 -UsePm2
```

```bash
bash scripts/run-local-prod.sh
bash scripts/run-local-prod.sh --pm2
```

## Execucao automatica em segundo plano

O backend possui scheduler interno.

- `ENABLE_BACKGROUND_SCHEDULER=true` liga o agendador.
- `MONITOR_INTERVAL_MINUTES=10` roda a cada 10 minutos por padrao.
- `RUN_ON_BOOT=true` dispara uma coleta ao subir a API.
- O backend bloqueia execucoes simultaneas.
- O Dashboard mostra se o agendador esta ativo e a proxima execucao.

Controle via API:

```http
GET /api/monitor/status
POST /api/monitor/run
POST /api/monitor/pause
POST /api/monitor/resume
```

## PM2

Para deixar rodando enquanto o PC estiver ligado:

```bash
npm run build
npm run pm2:start
```

Comandos:

```bash
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

O processo PM2 se chama `pokemon-rayquaza-monitor` e usa `ecosystem.config.js`.

## Acesso pelo celular fora da rede local

O caminho preferencial e Cloudflare Tunnel apontando para:

```env
CLOUDFLARE_TUNNEL_TARGET=http://localhost:3333
```

Teste rapido:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1 -RunQuickTunnel
```

```bash
bash scripts/setup-cloudflared.sh --run-quick-tunnel
```

Para dominio fixo, configure `CLOUDFLARE_TUNNEL_HOSTNAME` e `APP_PUBLIC_URL` no `.env`.

Guia completo: [docs/CLOUDFLARE_TUNNEL.md](docs/CLOUDFLARE_TUNNEL.md).

## Deploy futuro em VM

Nao e necessario usar VM agora. O projeto ficou preparado para uma VM Linux futura com:

- `scripts/vm-bootstrap.sh`
- `scripts/vm-update.sh`
- [docs/ORACLE_VM_DEPLOY.md](docs/ORACLE_VM_DEPLOY.md)

Guia local/PM2: [docs/LOCAL_ACCESS.md](docs/LOCAL_ACCESS.md).

## Tela Anuncios

A antiga tela de "Novos Anuncios" virou `Anuncios`.

- A rota principal e `/offers` e a alias amigavel e `/anuncios`.
- A tela abre com `newOnly=true` e `activeOnly=true`.
- O checkbox `Novos anuncios` vem marcado por padrao.
- Ao desmarcar esse filtro, a tela passa a mostrar todos os anuncios ativos.
- Enquanto o monitor roda, os novos anuncios entram no topo da tabela em tempo real.

## Progresso em tempo real

O backend expoe:

- `GET /api/monitor/status`
- `GET /api/monitor/events`
- `POST /api/monitor/run`
- `POST /api/monitor/pause`
- `POST /api/monitor/resume`

O frontend usa **Server-Sent Events (SSE)** para atualizar:

- etapa atual do monitor
- fonte atual
- card atual
- cards processados
- ofertas encontradas
- novos anuncios encontrados
- status do agendador e proxima execucao
- lista compacta de "Novos cadastrados agora"

Se a conexao SSE cair, a interface faz fallback para polling leve.

## Como funciona a deteccao de novos anuncios

- `first_seen_at` guarda quando a oferta apareceu pela primeira vez.
- `first_seen_run_id` guarda em qual execucao ela nasceu.
- `is_new` e marcado para ofertas vistas pela primeira vez na execucao mais recente.
- Mudanca de preco nao cria nova oferta: atualiza `last_price_cents` e adiciona item em `price_history`.
- Ofertas que somem nao sao removidas na hora.
- `missing_count` aumenta a cada execucao em que a oferta nao aparece.
- `is_active` so vira `false` depois de 3 execucoes consecutivas sem aparecer.

## Normalizacao de idioma e estado

- `language_raw` e `condition_raw` sempre preservam o texto original do DOM.
- O projeto normaliza idiomas para codigos internos como `PORTUGUESE`, `ENGLISH`, `JAPANESE`, `SPANISH`, `ITALIAN`, `FRENCH` e `GERMAN`.
- O projeto normaliza estados para `M`, `NM`, `EX`, `SP`, `MP`, `PL`, `PO` e `UNKNOWN`.

## Controle de velocidade

- `DETAIL_CONCURRENCY=1` e o padrao seguro.
- Pode subir para `2` ou `3` quando quiser acelerar com cuidado.
- `CARD_DETAIL_TIMEOUT_MS` impede que um card lento trave a execucao inteira.
- `SCRAPER_FAST_MODE=true` reduz delays, mas ainda mantem uma navegacao responsavel.
- Cards novos entram primeiro na fila para a interface mostrar novidades mais cedo.

## Estrutura principal

```text
src/
  api/          # rotas Express
  app/          # interface React (Vite)
  config/       # variaveis de ambiente
  db/           # schema, migracoes e repositorios
  domain/       # tipos compartilhados
  normalizers/  # idioma, estado, texto, preco e chaves canonicas
  services/     # monitor, diff, run, progresso em tempo real
  sources/      # scrapers por fonte
scripts/        # db:init, monitor
storage/        # SQLite, screenshots e cache de cambio
docs/           # documentacao adicional
```

## API local

Endpoints principais:

- `GET /api/dashboard`
- `GET /api/health`
- `GET /api/cards`
- `GET /api/cards/:id`
- `GET /api/cards/:id/offers`
- `GET /api/offers`
- `GET /api/offers/new`
- `GET /api/offers/recent-new`
- `GET /api/monitor/status`
- `GET /api/monitor/events`
- `GET /api/runs`
- `POST /api/monitor/run`
- `POST /api/monitor/pause`
- `POST /api/monitor/resume`

Mais detalhes em [docs/API.md](docs/API.md).

## Troubleshooting

- Se a coleta vier vazia, confira o terminal e a pasta `storage/screenshots/`.
- Se algum site mudar o DOM, ajuste `selectors.ts` e `mapper.ts` da fonte correspondente.
- Se o Chromium ainda nao estiver instalado, rode `npm run playwright:install`.
- Se a interface nao atualizar em tempo real, confira `GET /api/monitor/events`.
- Se quiser reduzir a carga no site, mantenha `DETAIL_CONCURRENCY=1` e `SCRAPER_FAST_MODE=false`.
- Se um site bloquear a navegacao automatizada, o monitor registra o erro, salva screenshot e continua nas outras fontes.

## Contribuindo

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir PRs ou alterar scrapers.
