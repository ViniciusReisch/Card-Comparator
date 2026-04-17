# API

Base local: `http://localhost:3333`

## `GET /api/dashboard`

Retorna estatisticas gerais, ultimo resumo de execucao, distribuicoes e lista resumida de anuncios novos.

### Resposta

```json
{
  "stats": {
    "totalCards": 259,
    "totalOffers": 2450,
    "newOffers": 12,
    "lowestPriceBrlCents": 3944
  },
  "lastRun": { "startedAt": "...", "status": "success", ... },
  "languageDistribution": [
    { "language": "ITALIAN", "count": 962 },
    { "language": "ENGLISH", "count": 936 }
  ],
  "conditionDistribution": [
    { "condition": "NM", "count": 947 },
    { "condition": "SP", "count": 451 }
  ],
  "recentNewOffers": [ ... ]
}
```

## `GET /api/cards`

Lista cards agrupados.

### Query params

| Param      | Descricao                          |
|------------|------------------------------------|
| source     | Filtrar por fonte (LIGA_POKEMON / CARDTRADER) |
| collection | Filtrar por colecao (texto parcial) |
| year       | Filtrar por ano                    |
| query      | Busca por nome ou colecao          |
| page       | Pagina (default: 1)                |
| limit      | Itens por pagina (default: 50)     |

### Resposta

```json
{
  "items": [
    {
      "id": 1,
      "name": "Rayquaza",
      "setName": "Hidden Fates",
      "year": 2019,
      "number": "SV69",
      "sources": ["CARDTRADER"],
      "offerCount": 23,
      "minPriceCents": 3944,
      "imageUrl": "https://..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 259 }
}
```

## `GET /api/cards/:id`

Retorna resumo de um card agrupado.

### Resposta

```json
{
  "id": 1,
  "name": "Rayquaza",
  "setName": "Hidden Fates",
  "year": 2019,
  "number": "SV69",
  "sources": ["CARDTRADER"],
  "offerCount": 23,
  "minPriceCents": 3944,
  "imageUrl": "https://..."
}
```

## `GET /api/cards/:id/offers`

Retorna todas as ofertas do card com filtros.

### Query params

| Param      | Descricao                                      |
|------------|------------------------------------------------|
| source     | LIGA_POKEMON / CARDTRADER                      |
| language   | PORTUGUESE / ENGLISH / JAPANESE / ... (14 opcoes) |
| condition  | M / NM / EX / SP / MP / PL / PO / UNKNOWN     |
| minPrice   | Preco minimo em BRL (sem centavos, ex: 30)     |
| maxPrice   | Preco maximo em BRL                            |
| collection | Texto parcial da colecao                       |
| year       | Ano da colecao                                 |
| search     | Busca livre por nome, colecao ou vendedor      |
| page       | Pagina (default: 1)                            |
| limit      | Itens por pagina (default: 50, max: 200)       |

### Resposta

```json
{
  "items": [
    {
      "id": 42,
      "source": "CARDTRADER",
      "cardName": "Rayquaza",
      "setName": "Hidden Fates",
      "year": 2019,
      "language": "ENGLISH",
      "condition": "NM",
      "priceCents": 680,
      "currency": "USD",
      "priceBrlCents": 3944,
      "exchangeRateToBrl": 5.8,
      "exchangeRateDate": "2026-04-17",
      "sellerName": "TCG Shop",
      "storeName": "CardTrader Store",
      "quantity": 2,
      "isNew": false,
      "firstSeenAt": "2026-04-10T12:00:00.000Z",
      "detailUrl": "https://..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 23 }
}
```

## `GET /api/offers`

Lista ofertas com os mesmos filtros de `/api/cards/:id/offers`, sem restringir por card.

## `GET /api/offers/new`

Lista apenas ofertas com `is_new = true`, ordenadas por `first_seen_at` decrescente.

Aceita os mesmos filtros de `/api/offers`.

## `GET /api/runs`

Lista historico de execucoes incluindo resumo por fonte.

### Resposta

```json
[
  {
    "id": 5,
    "startedAt": "2026-04-17T10:00:00.000Z",
    "finishedAt": "2026-04-17T10:08:22.000Z",
    "status": "success",
    "totalCardsFound": 259,
    "totalOffersFound": 2450,
    "newOffersFound": 12,
    "sources": [
      { "source": "LIGA_POKEMON", "cardsFound": 18, "offersFound": 36, "newOffersFound": 3 },
      { "source": "CARDTRADER", "cardsFound": 241, "offersFound": 2414, "newOffersFound": 9 }
    ]
  }
]
```

## `POST /api/monitor/run`

Executa o monitor manualmente.

- Nao permite execucoes simultaneas.
- Retorna `409` quando uma execucao ja esta em andamento.
- Retorna `200` com o resultado da execucao ao finalizar.

### Resposta de sucesso

```json
{
  "status": "success",
  "runId": 6,
  "totalCardsFound": 261,
  "totalOffersFound": 2460,
  "newOffersFound": 10
}
```

## Idiomas aceitos nos filtros

`PORTUGUESE`, `ENGLISH`, `JAPANESE`, `SPANISH`, `FRENCH`, `GERMAN`, `ITALIAN`, `KOREAN`, `CHINESE_SIMPLIFIED`, `CHINESE_TRADITIONAL`, `THAI`, `INDONESIAN`, `RUSSIAN`, `DUTCH`, `UNKNOWN`

## Estados aceitos nos filtros

`M`, `NM`, `EX`, `SP`, `MP`, `PL`, `PO`, `UNKNOWN`
