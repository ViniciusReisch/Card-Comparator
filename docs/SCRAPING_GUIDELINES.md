# Scraping Guidelines

## Coleta permitida

- Apenas dados publicamente visiveis por navegacao normal.
- Apenas navegacao com Playwright sem login ou sessao autenticada.
- Sem bypass de captcha, login ou protecao.

## Execucao responsavel

- Respeite `REQUEST_DELAY_MS` entre requisicoes.
- Evite aumentar `DETAIL_CONCURRENCY` sem necessidade.
- Nao rode o monitor em loop continuo ou em intervalos muito curtos.
- Use `LIGA_MAX_VER_MAIS_CLICKS` para limitar quantas vezes o botao "Ver Mais" sera clicado.

## Liga Pokemon — scraper "Ver Mais"

O scraper expande a lista clicando em "Ver Mais" de forma controlada:

1. Conta os cards visiveis antes do clique (`countCards()`).
2. Rola a tela ate o botao para garanti-lo na area visivel.
3. Tenta o clique nativo do Playwright.
4. Se falhar, tenta `element.evaluate(el => el.click())` no DOM.
5. Aguarda `networkidle` ou timeout de 3 segundos.
6. Conta os cards novamente. Se o numero nao aumentou, incrementa `stuckCount`.
7. Quando `stuckCount >= 3`, encerra a expansao (stuck detection).
8. Apos terminar a expansao, deduplica as URLs antes de entrar nos detalhes.

Se o botao mudar de seletor, atualize `selectors.ts` da fonte `ligapokemon`.

## CardTrader — extracao de idioma

O idioma de cada oferta e extraido tentando os seguintes seletores em ordem:

1. `td.products-table__info--language` — celula dedicada de idioma.
2. `[data-original-title]` — tooltip Bootstrap.
3. `[title]` — atributo title generico.
4. Fallback para `UNKNOWN` se nenhum encontrar texto util.

Se o CardTrader mudar sua estrutura HTML, ajuste os seletores em `cardtrader.scraper.ts`.

## Quando algo quebrar

- Consulte logs do terminal (cada card e fonte tem log de erro isolado).
- Verifique screenshots em `storage/screenshots/` — o scraper salva uma captura quando algo falha.
- Ajuste primeiro `selectors.ts` da fonte afetada.
- Ajuste `mapper.ts` quando a estrutura textual mudar (novos textos de idioma, estado, etc.).
- Preserve o tratamento de erro por card e por fonte — um erro num card nao deve parar a coleta dos outros.

## Mudancas de DOM

Seletores podem mudar com o tempo. Quando isso acontecer:

1. Atualize o `selectors.ts` da fonte.
2. Revise o `mapper.ts` para novos textos ou campos.
3. Rode `npm run monitor`.
4. Confirme se a API e a interface continuam funcionando corretamente.

## Adicionar uma nova fonte

1. Crie uma pasta em `src/sources/<nome-da-fonte>/`.
2. Implemente `selectors.ts`, `mapper.ts` e `scraper.ts` seguindo o padrao das fontes existentes.
3. O mapper deve retornar `RawCard[]` e `RawOffer[]` normalizados.
4. Registre a nova fonte em `monitor.service.ts`.
5. Adicione a fonte na documentacao e nos filtros da UI.
