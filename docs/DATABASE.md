# Database

## Tabela `cards`

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
- `rarity`
- `image_url`
- `detail_url`
- `first_seen_at`
- `last_seen_at`
- `raw_hash`
- `raw_json`

## Tabela `offers`

Representa uma oferta individual de um card.

Campos principais:

- `card_id`
- `source`
- `source_offer_id`
- `canonical_offer_key`
- `language_raw`
- `language_normalized`
- `condition_raw`
- `condition_normalized`
- `price_cents`
- `currency`
- `seller_name`
- `seller_country`
- `store_name`
- `quantity`
- `is_new`
- `is_active`
- `first_seen_at`
- `last_seen_at`
- `last_price_cents`
- `missing_count`
- `raw_hash`
- `raw_json`

## Tabela `monitor_runs`

Resumo da execucao global.

Campos principais:

- `started_at`
- `finished_at`
- `status`
- `total_cards_found`
- `total_offers_found`
- `new_offers_found`
- `error_message`

## Tabela `monitor_run_sources`

Resumo por fonte dentro de uma execucao.

Campos principais:

- `run_id`
- `source`
- `status`
- `cards_found`
- `offers_found`
- `new_offers_found`
- `error_message`

## Tabela `price_history`

Historico de variacoes de preco por oferta.

Campos principais:

- `offer_id`
- `price_cents`
- `currency`
- `seen_at`

