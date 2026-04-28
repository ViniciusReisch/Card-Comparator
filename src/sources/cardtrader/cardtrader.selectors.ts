export const cardTraderSelectors = {
  listingCardLinks: [
    "a[href*='/products/']",
    "a[href*='/cards/']",
    "a[href*='/expansions/']"
  ],
  nextPage: [
    "a[rel='next']",
    "a[aria-label='Next']",
    ".pagination a.next_page",
    ".pagination a[title='Next']"
  ],
  detailName: ["h1", ".page-title", ".product-name", "[data-testid='product-name']"],
  detailImage: [".main-image img", ".product-image img", ".carousel img", "img"],
  offerRows: [
    "table tbody tr",
    ".seller",
    ".seller-row",
    ".seller-card",
    ".available-products > *",
    ".for-sale > *",
    "[data-testid*='seller']",
    "[class*='seller']"
  ]
} as const;

