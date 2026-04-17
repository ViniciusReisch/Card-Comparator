# Architecture

## Visao geral

O projeto foi dividido em camadas leves para manter manutencao simples e evolucao gradual, sem Docker e sem arquitetura pesada.

## Camadas

### `sources/`

Contem scrapers, seletores e mappers por fonte.

- `selectors.ts`: centraliza seletores DOM e evita espalhar strings no scraper.
- `mapper.ts`: transforma dados crus em seeds normalizadas da aplicacao.
- `scraper.ts`: controla Playwright, delays, paginacao, screenshots e fluxo de coleta.

Fontes implementadas:
- `ligapokemon/` — scraper com expansao "Ver Mais", deduplicacao por URL, stuck detection
- `cardtrader/` — scraper com paginacao numerica, extracao de idioma por multiplos seletores

### `normalizers/`

Responsavel por padronizar texto, idioma, estado, preco e chaves canonicas.

- `language-normalizer.ts` — mapeia texto livre para 14 codigos de idioma
- `condition-normalizer.ts` — mapeia texto livre para 8 codigos de estado (M/NM/EX/SP/MP/PL/PO/UNKNOWN)
- `text-normalizer.ts` — normaliza strings para comparacao e chaves canonicas
- `price-normalizer.ts` — converte valores de texto para centavos inteiros

### `services/`

Coordena regras de negocio.

- `currency-converter.ts` — singleton que carrega taxas de cambio do Frankfurter API uma vez por dia e expoe `convertToBrl()` sincrono. Cache em `storage/exchange-rate-cache.json`.
- `diff.service.ts` — persiste cards e ofertas, decide o que e novo, chama `convertToBrl()` antes de cada upsert.
- `run.service.ts` — registra `monitor_runs` e `monitor_run_sources`.
- `monitor.service.ts` — orquestra scrapers, inicializa `currencyConverter`, persiste resultados e produz resumo final.

### `db/`

Contem schema SQLite, migracoes, conexao e repositorios.

- `database.ts` — abre a conexao e aplica pragmas (WAL, foreign keys).
- `migrations.ts` — executa `schema.sql` e aplica migracoes incrementais.
- `repositories/` — encapsula queries e regras de upsert/leitura por entidade.

### `api/`

Expoe dados locais por HTTP usando Express.

- `routes/` — rotas agrupadas por recurso (cards, offers, dashboard, runs, monitor).
- `route-helpers.ts` — mapeamento de registros do banco para DTOs da API (inclui campos BRL).

### `app/`

Interface React consumindo a API local via Vite.

- `pages/` — DashboardPage, CardsPage, CardDetailPage, NewOffersPage, RunsPage
- `components/` — Layout, FiltersBar, CardTile, OfferTable, OfferCard, LanguageBadge, ConditionBadge, SourceBadge, StatCard
- `api/client.ts` — wrapper fetch com helpers `formatBrl()`, `formatOriginalPrice()`, `getPrimaryPrice()`
- `styles/global.css` — design system com CSS custom properties, badges, grid

### `config/`

Carrega e valida variaveis de ambiente via zod.

## Fluxo de monitoramento

1. O monitor inicia uma nova execucao em `monitor_runs`.
2. `currencyConverter.initialize()` busca taxas do dia (cache ou API).
3. O sistema limpa o marcador `is_new` das ofertas anteriores.
4. Cada fonte e processada separadamente.
5. O scraper abre a pagina de busca, encontra cards e entra no detalhe de cada um.
6. O mapper transforma os dados crus em tipos normalizados (idioma, estado, preco).
7. O diff chama `currencyConverter.convertToBrl()` e persiste cards e ofertas.
8. Novas ofertas recebem `is_new = true`.
9. Ofertas conhecidas atualizam `last_seen_at` e `price_brl_cents`.
10. Mudancas de preco geram entrada em `price_history` com campos BRL.
11. Ofertas ausentes por 3 execucoes seguidas viram `is_active = false`.
12. O resumo final da execucao e salvo no banco e exposto na API.

## Fluxo de conversao BRL

```
monitor.service → currencyConverter.initialize()
                       ↓
              Verifica cache (storage/exchange-rate-cache.json)
                       ↓
        Cache do dia existe? → usa taxas do cache
        Nao existe?          → GET api.frankfurter.app/latest?from=EUR
                                 ↓ falha?
                             usa taxas de fallback embutidas
                       ↓
diff.service → currencyConverter.convertToBrl(priceCents, currency)
            → retorna { priceBrlCents, rate, date }
            → salva nos campos original_price_cents, price_brl_cents, etc.
```

## Decisoes de design

- **Sem ORM**: queries diretas com better-sqlite3 para manter controle total e sem overhead.
- **Sem heavy framework**: Express puro, React com CSS custom properties, sem Tailwind/MUI.
- **Singleton currency converter**: inicializado uma vez por run para evitar chamadas multiplas.
- **Migrations idempotentes**: `ALTER TABLE` com try-catch para nao quebrar em bases existentes.
- **Dois tsconfig**: `tsconfig.json` para o servidor (CommonJS) e `tsconfig.app.json` para o app React (ESM).
