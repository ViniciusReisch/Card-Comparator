# Database

SQLite em modo WAL. Arquivo padrao em `storage/monitor.sqlite`.

## `cards`

Representa um card identificado dentro de uma fonte.

Campos principais:

- `source`
- `source_card_id`
- `canonical_card_key`
- `name`
- `set_name`
- `set_code`
- `year`
- `number`
- `image_url`
- `detail_url`
- `first_seen_at`
- `last_seen_at`
- `raw_json`

## `offers`

Representa uma oferta individual.

Campos principais:

- `card_id`
- `source`
- `source_offer_id`
- `canonical_offer_key`
- `card_name`
- `set_name`
- `language_raw`
- `language_normalized`
- `condition_raw`
- `condition_normalized`
- `price_cents`
- `currency`
- `price_brl_cents`
- `seller_name`
- `seller_country`
- `store_name`
- `quantity`
- `is_new`
- `is_active`
- `first_seen_run_id`
- `first_seen_at`
- `last_seen_at`
- `last_price_cents`
- `missing_count`
- `raw_json`

### Regra de novidade

- `first_seen_at`: primeira vez que a oferta apareceu
- `first_seen_run_id`: execucao em que a oferta nasceu
- `is_new`: marcador para a execucao mais recente

## `monitor_runs`

Resumo global da execucao.

Campos principais:

- `started_at`
- `finished_at`
- `status`
- `total_cards_found`
- `total_offers_found`
- `new_offers_found`
- `progress_snapshot_json`
- `duration_ms`
- `estimated_total_cards`
- `processed_cards`
- `total_sources_done`
- `error_message`

## `monitor_run_sources`

Resumo por fonte dentro de uma execucao.

Campos principais:

- `run_id`
- `source`
- `status`
- `cards_found`
- `offers_found`
- `new_offers_found`
- `error_message`

## `price_history`

Historico de variacoes de preco por oferta.

Campos principais:

- `offer_id`
- `price_cents`
- `currency`
- `price_brl_cents`
- `exchange_rate_to_brl`
- `seen_at`

## Regras de reconciliacao

- oferta conhecida reapareceu: atualiza `last_seen_at`, zera `missing_count`
- oferta sumiu: incrementa `missing_count`
- `is_active = false` apenas depois de `missing_count >= 3`
- mudanca de preco nao cria nova oferta; grava em `price_history`
