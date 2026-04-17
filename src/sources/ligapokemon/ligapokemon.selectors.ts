export const ligaPokemonSelectors = {
  listingCardLinks: [
    "a[href*='view=cards/card']",
    "a[href*='cards/card']",
    "a[href*='view=cards/info']",
    "a[href*='view=cards%2Finfo']",
    "a[href*='cards/info']",
    "a[href*='/cards/']"
  ],
  loadMoreButtons: [
    "button",
    "a.btn",
    "a.button",
    "[role='button']"
  ],
  detailName: ["h1", ".tituloPagina", ".title", ".nomeCarta", ".card-title"],
  detailImage: [".main-image img", ".card-image img", "img[src*='cards']", "img"],
  offerRows: [
    ".store",
    "table tr",
    ".seller-card",
    ".seller-row",
    ".store-card",
    ".offer-card",
    ".offers-list > *",
    ".lista-lojas > *",
    ".boxOfertas > *",
    ".tab-content tr"
  ]
} as const;
