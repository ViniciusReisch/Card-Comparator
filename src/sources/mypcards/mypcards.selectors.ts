export const mypCardsSelectors = {
  listingItems: [
    "#produtos-lista-principal > li.stream-item",
    "#produtos-lista-principal li.stream-item",
    "section[data-ga-item-list-id='marca_pokemon_cartas_avulsas'] li.stream-item"
  ],
  listingItemLink: [
    "a.bt-offers[href*='/pokemon/produto/']",
    "a.card-img-link[href*='/pokemon/produto/']"
  ],
  listingItemName: [
    ".card-name h3",
    ".card-name",
    ".nome-produto",
    ".product-name",
    ".card-name",
    ".nome",
    "h2",
    "h3",
    "strong",
    ".title"
  ],
  listingItemSet: [
    ".card-edicao",
    ".card-subname",
    ".edicao",
    ".colecao",
    ".edition",
    ".set-name",
    ".set",
    ".colecao-nome"
  ],
  listingItemQty: [
    ".quantidade-num",
    ".quantidade",
    ".qty",
    ".estoque",
    ".disponivel",
    "[data-qty]",
    ".count"
  ],
  listingItemPrice: [
    ".card-preco.moeda",
    ".card-preco",
    ".preco",
    ".price",
    ".valor",
    ".preco-base",
    ".preco-min"
  ],
  offerRows: [
    "#produto-listas tr[data-key]",
    ".estoque-index tr[data-key]",
    "table.items tbody tr",
    "tbody tr",
    ".oferta-row",
    ".offer-row",
    ".item-oferta",
    "table tr",
    ".oferta"
  ],
  offerPrice: [
    ".estoque-lista-precoestoque .moeda",
    ".estoque-lista-precoestoque",
    "td.preco",
    "td.price",
    ".preco",
    ".price",
    ".valor",
    "td:last-child"
  ],
  offerCondition: [
    ".estoque-lista-qualidadenome .obsestoque",
    ".estoque-lista-qualidadenome",
    "td.condicao",
    "td.condition",
    ".condicao",
    ".condition",
    ".qualidade"
  ],
  offerLanguage: [
    ".estoque-lista-qualidadenome .flag-icon[title]",
    "td.idioma",
    "td.language",
    ".idioma",
    ".language",
    ".lang"
  ],
  offerFinish: [
    ".estoque-lista-nomeenfoil",
    "td.versao",
    "td.acabamento",
    ".versao",
    ".acabamento",
    ".finish",
    ".variacao",
    ".versao-carta"
  ],
  offerSeller: [
    ".estoque-lista-nomevendedor a",
    ".estoque-lista-nomevendedor",
    "td.loja",
    "td.vendedor",
    "td.seller",
    ".loja",
    ".vendedor",
    ".seller",
    ".store"
  ],
  offerQty: [
    ".estoque-lista-quantidadeestoque",
    "td.quantidade",
    "td.qty",
    ".quantidade",
    ".qty",
    ".estoque-oferta"
  ],
  detailName: [
    "main h1",
    "h1.product-name",
    "h1.nome-card",
    "h1.card-name",
    "h1",
    ".product-name",
    ".card-name",
    ".nome-card",
    ".titulo"
  ],
  detailImage: [
    ".card-img img[alt]",
    ".produto-img-wrapper-cls img[alt]",
    "meta[property='og:image']",
    ".card-image img",
    ".product-image img",
    ".foto-carta img",
    ".imagem-card img",
    "img.card-img",
    "img.product-img",
    "img.img-fluid",
    ".thumbnail img",
    "img"
  ],
  detailSet: [
    "#produto-codigo .view-field:has(label)",
    ".edicao",
    ".colecao",
    ".set-name",
    ".edition",
    ".colecao-nome",
    "[data-edicao]"
  ],
  detailNumber: [
    ".numero-card",
    ".card-number",
    ".numero",
    "[data-numero]"
  ],
  detailYear: [
    ".ano",
    ".year",
    "[data-ano]"
  ]
} as const;
