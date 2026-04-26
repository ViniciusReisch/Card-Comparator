import { env } from "./env";

export const monitorConfig = {
  sources: {
    ligapokemon: {
      name: "Liga Pokemon",
      key: "LIGA_POKEMON",
      searchUrl:
        "https://www.ligapokemon.com.br/?view=cards%2Fsearch&tipo=1&card=rayquaza",
      maxVerMaisClicks: env.LIGA_MAX_VER_MAIS_CLICKS
    },
    cardtrader: {
      name: "CardTrader",
      key: "CARDTRADER",
      searchUrl:
        "https://www.cardtrader.com/en/manasearch_results?q=rayquaza",
      maxPages: env.CARDTRADER_MAX_PAGES
    }
  },
  delays: {
    requestMs: env.REQUEST_DELAY_MS,
    slowMo: env.SLOW_MO,
    fastMode: env.SCRAPER_FAST_MODE
  },
  mypcards: {
    enabled: env.MYP_ENABLED,
    maxPages: env.MYP_MAX_PAGES,
    requestDelayMs: env.MYP_REQUEST_DELAY_MS,
    cardTimeoutMs: env.MYP_CARD_TIMEOUT_MS,
    searchUrl: "https://mypcards.com/pokemon?ProdutoSearch%5Bmarca%5D=pokemon&ProdutoSearch%5Bquery%5D=Rayquaza&page="
  },
  monitor: {
    statusPollIntervalMs: env.MONITOR_STATUS_POLL_INTERVAL_MS,
    detailConcurrency: env.DETAIL_CONCURRENCY,
    cardDetailTimeoutMs: env.CARD_DETAIL_TIMEOUT_MS
  }
} as const;
