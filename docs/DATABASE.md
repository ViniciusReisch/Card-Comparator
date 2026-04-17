# Database

SQLite em modo WAL. Arquivo em `storage/monitor.sqlite`. Migracoes rodadas automaticamente pelo `npm run db:init`.

## Tabela `cards`

Representa um card identificado dentro de uma fonte.

| Campo              | Tipo    | Descricao                                     |
|--------------------|---------|-----------------------------------------------|
| id                 | INTEGER | PK autoincrement                              |
| source             | TEXT    | LIGA_POKEMON ou CARDTRADER                    |
| source_card_id     | TEXT    | ID unico do card na fonte                     |
| canonical_card_key | TEXT    | Chave de deduplicacao entre fontes            |
| name               | TEXT    | Nome normalizado do card                      |
| set_name           | TEXT    | Nome da colecao                               |
| set_code           | TEXT    | Codigo da colecao (quando disponivel)         |
| year               | INTEGER | Ano da colecao                                |
| number             | TEXT    | Numero do card na colecao                     |
| rarity             | TEXT    | Raridade (quando disponivel)                  |
| image_url          | TEXT    | URL da imagem do card                         |
| detail_url         | TEXT    | URL da pagina de detalhe                      |
| first_seen_at      | TEXT    | ISO 8601 — primeira vez que o card apareceu   |
| last_seen_at       | TEXT    | ISO 8601 — ultima vez visto                   |
| raw_hash           | TEXT    | Hash dos dados crus para detectar mudancas    |
| raw_json           | TEXT    | Dump JSON do dado cru para debug              |

## Tabela `offers`

Representa uma oferta individual de um card.

| Campo                | Tipo    | Descricao                                           |
|----------------------|---------|-----------------------------------------------------|
| id                   | INTEGER | PK autoincrement                                    |
| card_id              | INTEGER | FK para `cards`                                     |
| source               | TEXT    | LIGA_POKEMON ou CARDTRADER                          |
| source_offer_id      | TEXT    | ID da oferta na fonte (quando disponivel)           |
| canonical_offer_key  | TEXT    | Chave de deduplicacao de ofertas                    |
| language_raw         | TEXT    | Idioma como encontrado no DOM                       |
| language_normalized  | TEXT    | Codigo normalizado (ENGLISH, JAPANESE, etc.)        |
| condition_raw        | TEXT    | Estado como encontrado no DOM                       |
| condition_normalized | TEXT    | Codigo curto (NM, SP, PL, etc.)                     |
| price_cents          | INTEGER | Preco em centavos na moeda original                 |
| currency             | TEXT    | Moeda original (BRL, EUR, USD, etc.)                |
| original_price_cents | INTEGER | Copia do preco original antes da conversao          |
| original_currency    | TEXT    | Moeda antes da conversao                            |
| price_brl_cents      | INTEGER | Preco convertido para BRL em centavos               |
| exchange_rate_to_brl | REAL    | Taxa de cambio usada na conversao                   |
| exchange_rate_date   | TEXT    | Data (YYYY-MM-DD) da taxa de cambio                 |
| seller_name          | TEXT    | Nome do vendedor                                    |
| seller_country       | TEXT    | Pais do vendedor (nao exibido na UI)                |
| store_name           | TEXT    | Nome da loja (CardTrader)                           |
| quantity             | INTEGER | Quantidade disponivel                               |
| is_new               | INTEGER | 1 se a oferta e nova na ultima execucao             |
| is_active            | INTEGER | 0 se sumiu por 3+ execucoes                         |
| first_seen_at        | TEXT    | ISO 8601 — primeira vez visto                       |
| last_seen_at         | TEXT    | ISO 8601 — ultima vez visto                         |
| last_price_cents     | INTEGER | Preco da execucao anterior (para comparar)          |
| missing_count        | INTEGER | Quantas execucoes consecutivas a oferta sumiu       |
| raw_hash             | TEXT    | Hash dos dados crus                                 |
| raw_json             | TEXT    | Dump JSON para debug                                |

## Tabela `monitor_runs`

Resumo da execucao global.

| Campo              | Tipo    | Descricao                           |
|--------------------|---------|-------------------------------------|
| id                 | INTEGER | PK autoincrement                    |
| started_at         | TEXT    | ISO 8601                            |
| finished_at        | TEXT    | ISO 8601                            |
| status             | TEXT    | success / error                     |
| total_cards_found  | INTEGER | Total de cards coletados            |
| total_offers_found | INTEGER | Total de ofertas coletadas          |
| new_offers_found   | INTEGER | Novas ofertas detectadas            |
| error_message      | TEXT    | Mensagem de erro (quando aplicavel) |

## Tabela `monitor_run_sources`

Resumo por fonte dentro de uma execucao.

| Campo            | Tipo    | Descricao               |
|------------------|---------|-------------------------|
| id               | INTEGER | PK autoincrement        |
| run_id           | INTEGER | FK para `monitor_runs`  |
| source           | TEXT    | LIGA_POKEMON / CARDTRADER |
| status           | TEXT    | success / error         |
| cards_found      | INTEGER |                         |
| offers_found     | INTEGER |                         |
| new_offers_found | INTEGER |                         |
| error_message    | TEXT    |                         |

## Tabela `price_history`

Historico de variacoes de preco por oferta.

| Campo                | Tipo    | Descricao                              |
|----------------------|---------|----------------------------------------|
| id                   | INTEGER | PK autoincrement                       |
| offer_id             | INTEGER | FK para `offers`                       |
| price_cents          | INTEGER | Preco em centavos na moeda original    |
| currency             | TEXT    | Moeda original                         |
| price_brl_cents      | INTEGER | Preco em BRL na data da conversao      |
| exchange_rate_to_brl | REAL    | Taxa usada na conversao                |
| seen_at              | TEXT    | ISO 8601                               |

## Migracoes

As migracoes sao aplicadas em `src/db/migrations.ts` sempre que `npm run db:init` e executado.

- `addColumnIfMissing()`: adiciona colunas com `ALTER TABLE` encapsulado em try-catch. Idempotente.
- `applyDataMigrations()`: converte codigos de estado antigos (NEAR_MINT, SLIGHTLY_PLAYED, etc.) para o formato curto (NM, SP, etc.).
- `backfillBrlPrices()`: preenche `price_brl_cents` em registros existentes que ainda nao tem o campo preenchido, usando taxas de fallback.
