# Contributing

Obrigado por contribuir com o `card-comparator`.

## Como contribuir

- Abra uma issue para bugs ou mudancas maiores antes de abrir PR.
- Trabalhe em uma branch propria.
- Mantenha o escopo do PR pequeno e objetivo.
- Atualize documentacao quando a mudanca alterar fluxo, API ou banco.

## Como abrir issue

- Descreva o comportamento atual e o esperado.
- Informe a fonte afetada: Liga Pokemon, CardTrader, API ou interface.
- Se possivel, inclua logs relevantes e screenshots de falha.

## Como rodar localmente

```bash
npm install
npm run playwright:install
npm run db:init
npm run monitor
npm run dev
```

## Padrao de commits

Use Conventional Commits sempre que possivel.

Exemplos:

- `feat: add cardtrader scraper`
- `fix: harden ligapokemon selector fallback`
- `docs: expand api troubleshooting notes`

## Boas praticas para mexer nos scrapers

- Coletar apenas dados publicos.
- Nunca burlar captcha, login ou qualquer protecao.
- Respeitar delays e evitar paralelismo agressivo.
- Preferir ajuste de `selectors.ts` e `mapper.ts` antes de reescrever o scraper inteiro.
- Manter logs claros e screenshots de falha quando o DOM mudar.
- Se houver bloqueio parcial, preservar a execucao das demais fontes.

