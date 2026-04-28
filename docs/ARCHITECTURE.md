# Architecture

## Visao geral

O projeto foi dividido em camadas leves para manter manutencao simples, boa separacao de responsabilidades e evolucao gradual sem Docker e sem framework pesado.

## Camadas

### `sources/`

Contem scrapers, seletores e mappers por fonte.

- `selectors.ts`: centraliza seletores DOM.
- `mapper.ts`: transforma dados crus em seeds normalizadas.
- `scraper.ts`: controla Playwright, fila de detalhes, delays, screenshots e callbacks de progresso.

Fontes atuais:

- `ligapokemon/`
- `cardtrader/`

### `normalizers/`

Responsavel por padronizar texto, idioma, estado, preco e chaves canonicas.

- `language-normalizer.ts`
- `condition-normalizer.ts`
- `price-normalizer.ts`
- `text-normalizer.ts`
- `offer-key.ts`

### `db/`

Contem schema SQLite, migracoes, conexao e repositorios.

- `database.ts`: conexao e pragmas.
- `migrations.ts`: schema + migracoes incrementais.
- `repositories/`: queries e regras de upsert.

### `services/`

Coordena regras de negocio.

- `monitor.service.ts`: orquestra execucoes e fontes.
- `monitor-status.service.ts`: estado em memoria + SSE.
- `diff.service.ts`: persiste cards/ofertas e decide o que e novo.
- `run.service.ts`: registra execucoes e snapshots de progresso.
- `currency-converter.ts`: converte preco para BRL com cache diario.

### `api/`

Expoe dados locais por HTTP com Express.

- `dashboard.routes.ts`
- `cards.routes.ts`
- `offers.routes.ts`
- `monitor.routes.ts`
- `runs.routes.ts`

### `app/`

Interface React com Vite.

- `pages/`: dashboard, anuncios, cards, detalhe e execucoes.
- `components/`: filtros, badges, tabelas, layout e barra de progresso.
- `hooks/useMonitorStatus.ts`: consome SSE com fallback para polling.

## Fluxo de monitoramento

1. `POST /api/monitor/run` inicia uma execucao em background.
2. `monitor.service.ts` cria `monitor_runs` e publica estado inicial.
3. `currency-converter.ts` carrega as taxas do dia.
4. `diff.service.ts` limpa `is_new` da execucao anterior.
5. Cada fonte abre a busca, coleta a listagem e deduplica os cards.
6. O scraper separa a fila em `newCardsQueue` e `knownCardsQueue`.
7. Os detalhes sao processados primeiro para cards novos.
8. Cada card raspado e persistido imediatamente.
9. Quando uma oferta nova aparece:
   - entra no banco na hora
   - atualiza `new_offers_found`
   - entra em `recentNewOffers`
   - dispara evento SSE
10. O frontend recebe esse evento e atualiza o progresso e a tabela de anuncios.
11. No fim da fonte, o monitor reconciliia ofertas ausentes e fecha `monitor_run_sources`.
12. No fim da execucao, atualiza `monitor_runs`, publica `FINISHED` ou `FAILED` e mantem o ultimo snapshot salvo.

## Tela Anuncios

`Anuncios` virou a central unica de ofertas.

- rota principal: `/offers`
- alias: `/anuncios`
- filtro padrao: `newOnly=true`
- comportamento: ao desmarcar, a tela mostra todos os anuncios ativos

## Progresso em tempo real

O backend mantem um snapshot com:

- `currentRunId`
- `isRunning`
- `currentSource`
- `currentStage`
- `totalCardsEstimated`
- `processedCards`
- `totalOffersFound`
- `newOffersFound`
- `currentCardName`
- `currentCardImageUrl`
- `recentNewOffers`

Esse snapshot e servido por `GET /api/monitor/status` e transmitido por `GET /api/monitor/events`.

## Estrategia de estimativa

- Antes de conhecer o total real, o monitor usa o ultimo `monitor_run` concluido como referencia.
- Quando a listagem de uma fonte termina, o total real dessa fonte substitui a estimativa.
- O progresso percentual usa `processedCards / totalCardsEstimated`.
- Quando ainda nao ha total suficiente, a UI usa barra indeterminada.

## Velocidade e seguranca

- `DETAIL_CONCURRENCY` controla quantos detalhes podem ser raspados ao mesmo tempo.
- `CARD_DETAIL_TIMEOUT_MS` evita que um card lento bloqueie toda a fila.
- `SCRAPER_FAST_MODE` reduz waits fixos, mas mantem delays responsaveis.
- Cada erro de card salva screenshot e nao derruba a execucao inteira.
