# card-comparator — Rayquaza Monitor

Monitor local para acompanhar anuncios publicos de cards Rayquaza na Liga Pokemon e no CardTrader. Detecta novas ofertas, converte precos para BRL e exibe uma interface visual com filtros por idioma, estado e preco.

## Aviso de uso responsavel

Este projeto coleta apenas dados publicamente visiveis por navegacao normal.

- Nao burla captcha, login ou protecoes.
- Respeita delays entre paginas e detalhes.
- Salva logs e screenshots quando uma coleta falha.
- Deve ser usado de forma responsavel e conforme os termos dos sites monitorados.

## Funcionalidades

- Coleta cards Rayquaza nas URLs configuradas para Liga Pokemon e CardTrader.
- Entra na pagina de detalhe de cada card para buscar lojas, vendedores e ofertas.
- Converte todos os precos para BRL com taxa de cambio atualizada diariamente (Frankfurter API).
- Salva cards, ofertas, execucoes e historico de preco em SQLite.
- Detecta novas ofertas a partir da comparacao com a base local anterior.
- Mantem ofertas sumidas como inativas apenas depois de 3 execucoes sem aparecer.
- Normaliza idiomas (14 idiomas) e estados (M/NM/EX/SP/MP/PL/PO/UNKNOWN) de forma uniforme entre as fontes.
- Exibe dashboard local, lista de cards, novos anuncios, detalhe por card e historico de execucoes.
- Permite disparar o monitor manualmente pela CLI ou pela API.

## Stack

- Node.js
- TypeScript
- Playwright
- SQLite (better-sqlite3)
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

Cria o arquivo SQLite local, todas as tabelas e executa migracoes para bases de dados ja existentes (adiciona colunas de BRL sem destruir dados).

## Rodar o monitoramento

```bash
npm run monitor
```

Executa uma coleta unica, persiste cards e ofertas, converte precos para BRL, compara com a base anterior e marca novas ofertas.

## Rodar a interface local

```bash
npm run dev
```

- API Express: `http://localhost:3333`
- Interface Vite/React: `http://localhost:5173`

## Como funciona a conversao para BRL

Todos os precos sao convertidos para BRL no momento da coleta usando a **Frankfurter API** (`api.frankfurter.app`).

### Fluxo

1. Ao iniciar o monitor, o sistema tenta buscar as taxas de cambio do dia na Frankfurter API.
2. As taxas sao salvas em `storage/exchange-rate-cache.json` com a data do dia como chave.
3. Na proxima execucao do mesmo dia, o cache e reutilizado sem nova chamada externa.
4. Se a API estiver indisponivel ou a rede falhar, o sistema usa taxas de fallback embutidas:
   - EUR → 6.10
   - USD → 5.80
   - GBP → 7.30
   - JPY → 0.038
   - (e outras moedas)
5. O banco salva: `original_price_cents`, `original_currency`, `price_brl_cents`, `exchange_rate_to_brl`, `exchange_rate_date`.

### Como atualizar a cotacao

A taxa e atualizada automaticamente a cada dia em que o monitor roda. Para forcas uma atualizacao manual, apague `storage/exchange-rate-cache.json` e rode o monitor novamente.

## Como funciona a normalizacao de idioma

O campo `language_raw` salva o texto original encontrado no DOM. O sistema mapeia esse texto para um dos 14 idiomas normalizados:

| Codigo            | Idioma                |
|-------------------|-----------------------|
| PORTUGUESE        | Portugues             |
| ENGLISH           | Ingles                |
| JAPANESE          | Japones               |
| SPANISH           | Espanhol              |
| FRENCH            | Frances               |
| GERMAN            | Alemao                |
| ITALIAN           | Italiano              |
| KOREAN            | Coreano               |
| CHINESE_SIMPLIFIED   | Chines Simplificado |
| CHINESE_TRADITIONAL  | Chines Tradicional  |
| THAI              | Tailandes             |
| INDONESIAN        | Indonesio             |
| RUSSIAN           | Russo                 |
| DUTCH             | Holandes              |
| UNKNOWN           | Nao identificado      |

Quando nenhum padrao corresponde ao texto encontrado, o idioma e marcado como `UNKNOWN`.

## Como funciona a normalizacao de estado

O campo `condition_raw` salva o texto original. O sistema mapeia para 8 estados curtos:

| Codigo  | Descricao               |
|---------|-------------------------|
| M       | Mint                    |
| NM      | Near Mint               |
| EX      | Excellent               |
| SP      | Slightly Played         |
| MP      | Moderately Played       |
| PL      | Played / Heavily Played |
| PO      | Poor / Damaged          |
| UNKNOWN | Nao identificado        |

O mapeamento funciona para CardTrader (que usa texto formal como "Near Mint") e para Liga Pokemon (que usa texto variado encontrado no DOM).

## Como funciona o scraper da Liga Pokemon com "Ver Mais"

1. O scraper abre a pagina de busca do card.
2. Conta quantos cards estao visiveis na pagina.
3. Rola a tela ate o botao "Ver Mais" para garanti-lo visivel.
4. Clica no botao com ate 3 estrategias: click nativo do Playwright, `evaluate` direto no DOM, e scroll+click.
5. Aguarda a rede estabilizar (`networkidle`) ou um timeout.
6. Verifica se o numero de cards aumentou. Se nao aumentou por 3 tentativas consecutivas (stuck detection), encerra a expansao.
7. Cada URL de card e deduplicada antes de entrar no detalhe, evitando processar o mesmo card duas vezes.
8. O limite de cliques e controlado por `LIGA_MAX_VER_MAIS_CLICKS` no `.env`.

## Como funciona o scraper do CardTrader

1. O scraper busca cards por pagina usando a URL configurada.
2. Entra no detalhe de cada card para extrair todas as ofertas da tabela de vendedores.
3. Extrai o idioma de cada oferta tentando, em ordem:
   - Celula `td.products-table__info--language`
   - Atributo `data-original-title` no elemento pai
   - Atributo `title` no elemento pai
   - Fallback para `UNKNOWN` se nenhum funcionar
4. Respeita `REQUEST_DELAY_MS` entre paginas e `DETAIL_CONCURRENCY` para processar detalhes em paralelo.

## Limitacoes conhecidas

- O scraper da Liga Pokemon depende da estrutura DOM atual. Se o botao "Ver Mais" mudar de seletor, a expansao para de funcionar.
- O CardTrader pode exibir idiomas em outros formatos em atualizacoes futuras; ajuste `selectors.ts` se isso acontecer.
- A conversao de BRL usa arredondamento para centavos inteiros.
- Ofertas com moeda desconhecida nao serao convertidas corretamente; o sistema exibira o preco original.
- Nao e possivel coletar a Liga Pokemon sem Playwright instalado.

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

## Estrutura principal

```text
src/
  api/          # rotas Express
  app/          # interface React (Vite)
  config/       # variaveis de ambiente
  db/           # schema, migracoes, repositorios
  domain/       # tipos compartilhados
  normalizers/  # idioma, estado, texto, preco
  services/     # monitor, diff, currency-converter
  sources/      # scrapers por fonte (liga, cardtrader)
scripts/        # db:init, validate
storage/        # SQLite, cache de cambio, screenshots
docs/           # documentacao adicional
```

## Troubleshooting

- Se a coleta vier vazia, confira logs do terminal e a pasta `storage/screenshots/`.
- Se algum site mudar seletores, ajuste os arquivos `selectors.ts` e os mappers da fonte correspondente.
- Se o Chromium ainda nao estiver instalado, rode `npm run playwright:install`.
- Se a API ou a UI nao subirem, rode `npm run build` para verificar erros de tipagem ou bundling.
- Se um site bloquear a navegacao automatizada, o monitor registra o erro e segue com as outras fontes.
- Se os precos BRL aparecerem zerados, rode `npm run db:init` para aplicar o backfill de migracoes.

## Contribuindo

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir PRs ou mudar scrapers.
