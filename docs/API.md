# API

Base local: `http://localhost:3333`

## `GET /api/health`

Retorna status simples da aplicacao, uptime e resumo operacional do monitor.

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "schedulerEnabled": true,
  "isRunning": false,
  "nextRunAt": "2026-04-20T15:10:00.000Z"
}
```

## `GET /api/dashboard`

Retorna estatisticas gerais, ultimo resumo de execucao, distribuicoes e lista resumida de anuncios novos.

## `GET /api/cards`

Lista cards agrupados.

### Query params

| Param | Descricao |
|---|---|
| `source` | `LIGA_POKEMON` ou `CARDTRADER` |
| `collection` | filtro textual por colecao |
| `year` | filtro por ano |
| `query` | busca por nome |
| `page` | pagina |
| `limit` | itens por pagina |

## `GET /api/cards/:id`

Retorna o resumo do card agrupado.

## `GET /api/cards/:id/offers`

Retorna ofertas do card com os mesmos filtros de `/api/offers`.

## `GET /api/offers`

Lista anuncios/ofertas.

### Query params

| Param | Descricao |
|---|---|
| `newOnly` | `true/false` |
| `activeOnly` | `true/false` |
| `source` | `LIGA_POKEMON` ou `CARDTRADER` |
| `language` | codigo normalizado do idioma |
| `condition` | `M`, `NM`, `EX`, `SP`, `MP`, `PL`, `PO`, `UNKNOWN` |
| `minPriceBrl` | preco minimo em BRL |
| `maxPriceBrl` | preco maximo em BRL |
| `setName` | filtro textual por colecao |
| `year` | filtro por ano |
| `search` | busca livre por nome, colecao, vendedor ou loja |
| `page` | pagina |
| `pageSize` | itens por pagina |
| `sort` | `latest`, `oldest`, `priceAsc`, `priceDesc` |

### Default usado pela tela Anuncios

```http
GET /api/offers?newOnly=true&activeOnly=true
```

Quando o checkbox `Novos anuncios` e desmarcado:

```http
GET /api/offers?newOnly=false&activeOnly=true
```

## `GET /api/offers/new`

Endpoint legado de conveniencia para listar apenas ofertas novas.

## `GET /api/offers/recent-new`

Retorna os anuncios novos mais recentes, util para dashboards e streaming visual.

## `GET /api/monitor/status`

Retorna o snapshot atual do monitor.

### Exemplo

```json
{
  "isRunning": true,
  "schedulerEnabled": true,
  "runId": 12,
  "currentRunId": 12,
  "startedAt": "2026-04-17T17:00:00.000Z",
  "finishedAt": null,
  "lastRunStartedAt": "2026-04-17T17:00:00.000Z",
  "lastRunFinishedAt": null,
  "nextRunAt": null,
  "currentSource": "LIGA_POKEMON",
  "currentStage": "SCRAPING_LIGA_CARD_DETAILS",
  "currentCardName": "Rayquaza VMAX",
  "processedCards": 34,
  "totalCardsEstimated": 120,
  "totalOffersFound": 412,
  "newOffersFound": 12,
  "progressPercent": 28,
  "message": "Coletando ofertas do card Rayquaza VMAX...",
  "recentNewOffers": []
}
```

## `GET /api/monitor/events`

Stream **SSE** com dois tipos de evento:

- `status`
- `new-offer`

`new-offer` entrega o anuncio novo e o snapshot atualizado do monitor.

## `POST /api/monitor/run`

Inicia o monitoramento manualmente em background.

- retorna `202`
- nao permite execucoes simultaneas
- retorna `409` quando ja existe um run em andamento

## `POST /api/monitor/pause`

Pausa o agendador automatico. Nao cancela uma coleta que ja esteja em andamento.

## `POST /api/monitor/resume`

Retoma o agendador automatico e agenda a proxima execucao pelo intervalo configurado em `MONITOR_INTERVAL_MINUTES`.

## `GET /api/runs`

Lista historico de execucoes incluindo resumo por fonte.
