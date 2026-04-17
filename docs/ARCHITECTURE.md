# Architecture

## Visao geral

O projeto foi dividido em camadas leves para manter manutencao simples e evolucao gradual, sem Docker e sem arquitetura pesada.

## Camadas

### `sources/`

Contem scrapers, seletores e mappers por fonte.

- `selectors.ts`: centraliza seletores DOM e evita espalhar strings no scraper.
- `mapper.ts`: transforma dados crus em seeds normalizadas da aplicacao.
- `scraper.ts`: controla Playwright, delays, paginator, screenshots e fluxo de coleta.

### `normalizers/`

Responsavel por padronizar texto, idioma, estado, preco e chaves canonicas.

### `db/`

Contem schema SQLite, migracao, conexao e repositorios.

- `database.ts`: abre a conexao e aplica pragmas.
- `migrations.ts`: executa `schema.sql`.
- `repositories/`: encapsula queries e regras de upsert/leitura.

### `services/`

Coordena regras de negocio.

- `diff.service.ts`: persiste cards e ofertas e decide o que e novo.
- `run.service.ts`: registra monitor_runs e monitor_run_sources.
- `monitor.service.ts`: orquestra scrapers, persistencia e resumo final.

### `api/`

Expose dados locais por HTTP usando Express.

### `app/`

Interface React consumindo a API local.

## Fluxo de monitoramento

1. O monitor inicia uma nova execucao em `monitor_runs`.
2. O sistema limpa o marcador `is_new` das ofertas anteriores.
3. Cada fonte e processada separadamente.
4. O scraper abre a pagina de busca, encontra cards e entra no detalhe de cada um.
5. O mapper transforma os dados crus em tipos normalizados.
6. O diff persiste cards e ofertas no banco.
7. Novas ofertas recebem `is_new = true`.
8. Ofertas conhecidas atualizam `last_seen_at`.
9. Mudancas de preco geram `price_history`.
10. Ofertas ausentes por 3 execucoes seguidas viram `is_active = false`.
11. O resumo final da execucao e salvo no banco e exposto na API.

