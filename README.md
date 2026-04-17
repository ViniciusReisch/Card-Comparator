# card-comparator

Monitor local para acompanhar anuncios publicos de cards Rayquaza na Liga Pokemon e no CardTrader, com foco em detectar novas ofertas desde a ultima execucao.

## Aviso de uso responsavel

Este projeto coleta apenas dados publicamente visiveis por navegacao normal.

- Nao burla captcha, login ou protecoes.
- Respeita delays entre paginas e detalhes.
- Salva logs e screenshots quando uma coleta falha.
- Deve ser usado de forma responsavel e conforme os termos dos sites monitorados.

## Funcionalidades

- Coleta cards Rayquaza nas URLs configuradas para Liga Pokemon e CardTrader.
- Entra na pagina de detalhe de cada card para buscar lojas, vendedores e ofertas.
- Salva cards, ofertas, execucoes e historico de preco em SQLite.
- Detecta novas ofertas a partir da comparacao com a base local anterior.
- Mantem ofertas sumidas como inativas apenas depois de 3 execucoes sem aparecer.
- Exibe dashboard local, lista de cards, novos anuncios, detalhe por card e historico de execucoes.
- Permite disparar o monitor manualmente pela CLI ou pela API.

## Stack

- Node.js
- TypeScript
- Playwright
- SQLite
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

Crie um arquivo `.env` a partir de `.env.example`.

```env
DATABASE_PATH=./storage/monitor.sqlite
HEADLESS=true
SLOW_MO=0
REQUEST_DELAY_MS=1500
LIGA_MAX_VER_MAIS_CLICKS=100
CARDTRADER_MAX_PAGES=200
DETAIL_CONCURRENCY=1
PORT=3333
VITE_API_URL=http://localhost:3333
```

## Inicializar o banco

```bash
npm run db:init
```

O comando cria o arquivo SQLite local e todas as tabelas do MVP.

## Rodar o monitoramento

```bash
npm run monitor
```

Esse comando executa uma coleta unica, persiste cards e ofertas, compara com a base anterior e marca novas ofertas.

## Rodar a interface local

```bash
npm run dev
```

- API Express: `http://localhost:3333`
- Interface Vite/React: `http://localhost:5173`

## API local

Endpoints principais:

- `GET /api/dashboard`
- `GET /api/cards`
- `GET /api/cards/:id`
- `GET /api/cards/:id/offers`
- `GET /api/offers`
- `GET /api/offers/new`
- `GET /api/runs`
- `POST /api/monitor/run`

Detalhes completos em [docs/API.md](docs/API.md).

## Como funciona a deteccao de novos anuncios

Cada oferta recebe um identificador estavel por fonte:

- Primeiro tenta `source + source_offer_id`.
- Quando isso nao existe, usa `canonical_offer_key`.
- Mudanca de preco nao cria uma oferta nova.
- Mudanca de preco atualiza `last_price_cents` e adiciona uma entrada em `price_history`.
- Ofertas novas da execucao atual ficam com `is_new = true`.
- Antes de uma nova execucao, o sistema limpa o marcador anterior para destacar apenas as novidades mais recentes.

## Como funciona a normalizacao de idioma e estado

- O idioma bruto sempre e salvo em `language_raw`.
- O estado bruto sempre e salvo em `condition_raw`.
- O sistema mapeia idiomas e estados para um padrao interno reutilizavel.
- Para CardTrader, os estados seguem o dicionario oficial do marketplace.
- Para Liga Pokemon, o mapeamento depende do texto encontrado no DOM e cai para `UNKNOWN` quando nao houver correspondencia segura.

## Estrutura principal

```text
src/
  api/
  app/
  config/
  db/
  domain/
  normalizers/
  services/
  sources/
scripts/
storage/
docs/
```

## Contribuindo

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir PRs ou mudar scrapers.

## Troubleshooting

- Se a coleta vier vazia, confira logs do terminal e a pasta `storage/screenshots/`.
- Se algum site mudar seletores, ajuste os arquivos `selectors.ts` e os mappers da fonte correspondente.
- Se o Chromium ainda nao estiver instalado, rode `npm run playwright:install`.
- Se a API ou a UI nao subirem, rode `npm run build` para verificar erros de tipagem ou bundling.
- Se um site bloquear a navegacao automatizada, o monitor deve registrar o erro e seguir com as outras fontes.

