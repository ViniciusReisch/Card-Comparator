# Scraping Guidelines

## Coleta permitida

- Apenas dados publicamente visiveis.
- Apenas navegacao normal com Playwright.
- Sem bypass de captcha, login ou protecao.

## Execucao responsavel

- Respeite `REQUEST_DELAY_MS`.
- Evite aumentar concorrencia sem necessidade.
- Mantenha `DETAIL_CONCURRENCY` baixo.

## Quando algo quebrar

- Consulte logs do terminal.
- Verifique screenshots salvas em `storage/screenshots/`.
- Ajuste primeiro `selectors.ts`.
- Ajuste `mapper.ts` quando a estrutura textual mudar.
- Preserve tratamento de erro por card e por fonte.

## Mudancas de DOM

Seletores podem mudar com o tempo. Quando isso acontecer:

1. Atualize o `selectors.ts` da fonte.
2. Revise o `mapper.ts` para novos textos ou campos.
3. Rode `npm run monitor`.
4. Confirme se a API e a interface continuam funcionando.

