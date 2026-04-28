export const ligaPokemonSelectors = {
  listingCardLinks: [
    ".mtg-single a.main-link-card[href*='view=cards/card']",
    "a[href*='view=cards/card']",
    "a[href*='cards/card']"
  ],
  loadMoreButtons: [
    "button",
    "a.btn",
    "a.button",
    "[role='button']",
    "input[type='button']",
    "input[type='submit']"
  ],
  loadMoreLabels: ["exibir mais", "ver mais"],
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
