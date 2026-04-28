# Scraping Guidelines

## Coleta permitida

- Apenas dados publicamente visiveis por navegacao normal.
- Apenas navegacao com Playwright sem login ou sessao autenticada.
- Sem bypass de captcha, login ou protecao.

## Execucao responsavel

- Respeite `REQUEST_DELAY_MS`.
- Use `DETAIL_CONCURRENCY=1` como padrao seguro.
- So aumente para `2` ou `3` se estiver validando com cuidado.
- `SCRAPER_FAST_MODE=true` acelera waits, mas nao remove o comportamento responsavel.
- `CARD_DETAIL_TIMEOUT_MS` evita que um card lento bloqueie toda a execucao.

## Prioridade para cards novos

Ao terminar a listagem de uma fonte, o scraper separa:

- `newCardsQueue`
- `knownCardsQueue`

Os cards novos vao primeiro para que as ofertas novas aparecam na interface o quanto antes.

## SSE e salvamento incremental

Cada card raspado e persistido imediatamente.

Quando uma oferta nova aparece:

1. ela entra no SQLite na hora
2. o contador de novidades e atualizado
3. `recentNewOffers` recebe o item
4. o backend dispara evento SSE
5. a tela `Anuncios` pode inserir o item no topo sem esperar o fim da execucao

## Liga Pokemon

O scraper:

1. abre a busca
2. tenta expandir `Ver Mais`
3. para quando o botao some, desabilita ou o total de cards nao cresce
4. deduplica URLs antes de entrar em detalhe
5. salva screenshot se um card falhar

## CardTrader

O scraper:

1. resolve a listagem configurada
2. deduplica cards identicos
3. entra no detalhe de cada card
4. extrai idioma, estado, preco, vendedor, pais e quantidade
5. salva screenshot se um card falhar

## Quando algo quebrar

- Consulte os logs do terminal.
- Verifique `storage/screenshots/`.
- Ajuste primeiro `selectors.ts`.
- Ajuste depois `mapper.ts`.
- Mantenha o tratamento de erro por card para nao derrubar a execucao inteira.
