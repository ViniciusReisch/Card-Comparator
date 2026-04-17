# API

Base local: `http://localhost:3333`

## `GET /api/dashboard`

Retorna estatisticas gerais, ultimo resumo de execucao e lista resumida de anuncios novos.

## `GET /api/cards`

Lista cards agrupados.

Query params:

- `source`
- `collection`
- `year`
- `query`
- `page`
- `limit`

## `GET /api/cards/:id`

Retorna o resumo de um card agrupado por nome/colecao/ano/numero.

## `GET /api/cards/:id/offers`

Retorna todas as ofertas do card com filtros.

Query params:

- `source`
- `language`
- `condition`
- `minPrice`
- `maxPrice`
- `collection`
- `year`
- `dateFrom`
- `dateTo`
- `page`
- `limit`

## `GET /api/offers`

Lista ofertas com filtros.

## `GET /api/offers/new`

Lista apenas ofertas com `is_new = true`, priorizadas por `first_seen_at` mais recente.

## `GET /api/runs`

Lista historico de execucoes, incluindo resumo por fonte.

## `POST /api/monitor/run`

Executa o monitor manualmente.

- Nao permite execucoes simultaneas.
- Retorna erro `409` quando uma execucao ja esta em andamento.

