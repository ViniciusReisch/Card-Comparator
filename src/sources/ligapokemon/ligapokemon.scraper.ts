import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { CardRepository } from "../../db/repositories/card.repository";
import type { ScrapedCardSeed, SourceScrapeResult } from "../../domain/card.types";
import type { SourceScraperHooks } from "../../domain/scraper.types";
import { buildCanonicalCardKey } from "../../normalizers/offer-key";
import { slugifyText } from "../../normalizers/text-normalizer";
import { env } from "../../config/env";
import { monitorConfig } from "../../config/monitor.config";
import {
  mapLigaPokemonCard,
  type LigaPokemonDetailRaw,
  type LigaPokemonListingRaw
} from "./ligapokemon.mapper";
import { ligaPokemonSelectors } from "./ligapokemon.selectors";

type QueuedLigaCard = {
  listing: LigaPokemonListingRaw;
  cardIsNew: boolean;
};

const cardRepository = new CardRepository();
const LIGA_PAGE_SIZE = 40;

type LigaAjaxConfig = {
  totalReg: string;
  search: string;
  orderBy: string;
  tipo: string;
  fav: string;
  iTCG: string;
  idPokemon: string;
};

function getRequestDelayMs(): number {
  if (!monitorConfig.delays.fastMode) {
    return monitorConfig.delays.requestMs;
  }

  return Math.max(350, Math.round(monitorConfig.delays.requestMs * 0.4));
}

function extractCardIdFromUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const card = url.searchParams.get("card");
    const edition = url.searchParams.get("ed");
    const number = url.searchParams.get("num");
    const composite = [card, edition, number].filter((part) => part && part.length > 0).join("|");
    if (composite.length > 0) return composite;
  } catch {
    // ignore invalid urls
  }

  const fromQuery = value.match(/[?&](?:id|card|cardid)=([^&#]+)/i);
  if (fromQuery) return decodeURIComponent(fromQuery[1] ?? "");

  const fromPath = value.match(/\/(\d+)(?:[/?#]|$)/);
  return fromPath?.[1] ?? null;
}

function buildListingSeed(listing: LigaPokemonListingRaw): ScrapedCardSeed {
  return {
    source: "LIGA_POKEMON",
    sourceCardId: listing.sourceCardId ?? extractCardIdFromUrl(listing.detailUrl),
    name: listing.name ?? "Rayquaza",
    setName: listing.setName,
    setCode: listing.setCode,
    year: listing.year,
    number: listing.number,
    rarity: listing.rarity,
    imageUrl: listing.imageUrl,
    detailUrl: listing.detailUrl,
    raw: listing.raw
  };
}

function splitCardsByKnownState(cards: LigaPokemonListingRaw[]): {
  newCardsQueue: QueuedLigaCard[];
  knownCardsQueue: QueuedLigaCard[];
} {
  const newCardsQueue: QueuedLigaCard[] = [];
  const knownCardsQueue: QueuedLigaCard[] = [];

  for (const listing of cards) {
    const seed = buildListingSeed(listing);
    const canonicalCardKey = buildCanonicalCardKey(seed);
    const existing = cardRepository.findByIdentity({
      source: seed.source,
      sourceCardId: seed.sourceCardId ?? canonicalCardKey,
      canonicalCardKey
    });

    if (existing) {
      knownCardsQueue.push({ listing, cardIsNew: false });
    } else {
      newCardsQueue.push({ listing, cardIsNew: true });
    }
  }

  return { newCardsQueue, knownCardsQueue };
}

async function maybeAcceptPopup(page: Page): Promise<void> {
  const buttons = [/aceitar/i, /entendi/i, /ok/i, /fechar/i, /continuar/i, /prosseguir/i];
  for (const name of buttons) {
    const button = page.getByRole("button", { name }).first();
    if ((await button.count()) === 0) continue;
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
    }
  }
}

async function waitForListingCards(page: Page): Promise<void> {
  await page
    .waitForSelector("a[href*='view=cards/card'], a[href*='cards/card']", {
      timeout: Math.min(15_000, monitorConfig.monitor.cardDetailTimeoutMs)
    })
    .catch(() => undefined);
}

async function ensurePageEvaluateHelpers(page: Page): Promise<void> {
  await page.evaluate("globalThis.__name = globalThis.__name || ((target) => target);").catch(() => undefined);
}

async function extractListingCards(page: Page, html: string | null = null): Promise<LigaPokemonListingRaw[]> {
  await ensurePageEvaluateHelpers(page);
  return page.evaluate(({ linkSelectors, html }) => {
    const root = html ? new DOMParser().parseFromString(html, "text/html") : document;

    function absoluteUrl(value: string | null): string | null {
      if (!value) return null;
      try {
        const url = new URL(value, location.href);
        return url.href;
      } catch {
        return null;
      }
    }

    function isCardDetailHref(value: string | null): boolean {
      const absolute = absoluteUrl(value);
      if (!absolute) return false;

      try {
        const url = new URL(absolute);
        return /cards\/card/i.test(url.searchParams.get("view") ?? "") || /view=cards\/card/i.test(url.href);
      } catch {
        return /view=cards\/card/i.test(absolute);
      }
    }

    function cleanText(value: string | null | undefined): string | null {
      const text = value?.replace(/\s+/g, " ").trim() ?? "";
      return text.length > 0 ? text : null;
    }

    function firstText(container: Element, selectors: string[]): string | null {
      for (const selector of selectors) {
        const text = cleanText(container.querySelector<HTMLElement>(selector)?.textContent);
        if (text) return text;
      }
      return null;
    }

    const uniqueAnchors = new Map<string, HTMLAnchorElement>();
    for (const selector of linkSelectors) {
      for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>(selector))) {
        const href = anchor.getAttribute("href");
        const detailUrl = absoluteUrl(href);
        if (!detailUrl || !isCardDetailHref(href) || uniqueAnchors.has(detailUrl)) continue;
        uniqueAnchors.set(detailUrl, anchor);
      }
    }

    return Array.from(uniqueAnchors.entries()).map(([detailUrl, anchor]) => {
      const container =
        anchor.closest(".mtg-single") ??
        anchor.closest("article, li, tr, .card, .row, .col, .box, .item") ??
        anchor.parentElement ??
        anchor;
      const image =
        container.querySelector<HTMLImageElement>(".main-card, img") ??
        anchor.querySelector<HTMLImageElement>("img");
      const rawImageUrl =
        image?.getAttribute("src") ??
        image?.getAttribute("data-src") ??
        image?.getAttribute("data-original") ??
        null;
      const imageUrl = absoluteUrl(rawImageUrl);
      const textChunks = Array.from(container.querySelectorAll("h1,h2,h3,h4,strong,span,small,p,div,a"))
        .map((element) => cleanText(element.textContent) ?? "")
        .filter(Boolean)
        .slice(0, 30);
      const nameCandidate =
        anchor.getAttribute("title") ||
        image?.getAttribute("alt") ||
        firstText(container, [".mtg-name-aux a", ".mtg-name a", ".mtg-name", ".mtg-names a"]) ||
        textChunks.find((value) => /rayquaza/i.test(value)) ||
        anchor.textContent;
      const setNameCandidate = firstText(container, [".edition-name", ".mtg-edition", ".edition"]);
      const numberCandidate =
        firstText(container, [".mtg-numeric-code"])?.replace(/[()]/g, "") ??
        detailUrl.match(/[?&]num=([^&#]+)/i)?.[1] ??
        textChunks.find((value) => /#?\d{1,4}[A-Z]?/i.test(value)) ??
        null;
      const yearCandidate = textChunks.find((value) => /\b(19|20)\d{2}\b/.test(value)) ?? null;

      return {
        sourceCardId: null,
        name: cleanText(nameCandidate),
        setName: setNameCandidate ?? textChunks.find((value) => !/rayquaza/i.test(value) && value !== yearCandidate) ?? null,
        setCode: null,
        year: yearCandidate ? Number(yearCandidate.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0) : null,
        number: numberCandidate,
        rarity: textChunks.find((value) => /rare|ultra|secret|promo|holo/i.test(value)) ?? null,
        imageUrl,
        detailUrl,
        raw: {
          textChunks,
          listingText: cleanText(container.textContent),
          listingSource: html ? "ajax" : "initial"
        }
      };
    });
  }, { linkSelectors: ligaPokemonSelectors.listingCardLinks, html });
}

async function extractAjaxConfig(page: Page): Promise<LigaAjaxConfig> {
  await ensurePageEvaluateHelpers(page);
  return page.evaluate(() => {
    const scripts = Array.from(document.scripts).map((script) => script.textContent ?? "").join("\n");
    const currentUrl = new URL(location.href);
    const readCall = (method: string): string | null => {
      const match = scripts.match(new RegExp(`mcards\\.${method}\\((?:\"([^\"]*)\"|'([^']*)'|([^)]*))\\)`));
      return (match?.[1] ?? match?.[2] ?? match?.[3] ?? null)?.trim() ?? null;
    };

    return {
      totalReg: readCall("setTotalReg") ?? "9999",
      search: readCall("setSearch") ?? currentUrl.searchParams.get("card") ?? "rayquaza",
      orderBy: currentUrl.searchParams.get("orderBy") ?? "",
      tipo: readCall("setTipo") ?? currentUrl.searchParams.get("tipo") ?? "1",
      fav: "false",
      iTCG: currentUrl.searchParams.get("iTCG") ?? "2",
      idPokemon: currentUrl.searchParams.get("idPokemon") ?? "0"
    };
  });
}

async function fetchLigaListingPage(
  page: Page,
  config: LigaAjaxConfig,
  pageNumber: number
): Promise<string> {
  const key = (pageNumber - 1) * LIGA_PAGE_SIZE;
  const result = await page.evaluate(
    async ({ config, pageNumber, key }) => {
      const body = new URLSearchParams({
        opc: "nextPage",
        page: String(pageNumber),
        totalReg: config.totalReg,
        search: config.search,
        orderBy: config.orderBy,
        tipo: config.tipo,
        fav: config.fav,
        iTCG: config.iTCG,
        idPokemon: config.idPokemon,
        key: String(key)
      });

      const response = await fetch("/ajax/cards/main.php", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        },
        body
      });

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text()
      };
    },
    { config, pageNumber, key }
  );

  if (!result.ok) {
    console.warn(`[ligapokemon] lote ${pageNumber} retornou status ${result.status}; encerrando paginacao`);
    return "";
  }

  let payload: { html?: unknown };
  try {
    payload = JSON.parse(result.text) as { html?: unknown };
  } catch {
    payload = { html: result.text };
  }

  return typeof payload.html === "string" ? payload.html : "";
}

async function collectAllListingCards(page: Page, hooks?: SourceScraperHooks): Promise<LigaPokemonListingRaw[]> {
  const uniqueCards = new Map<string, LigaPokemonListingRaw>();
  const addCards = (cards: LigaPokemonListingRaw[]) => {
    let added = 0;
    for (const card of cards) {
      if (!card.detailUrl || uniqueCards.has(card.detailUrl)) continue;
      try {
        const cardParam = (new URL(card.detailUrl).searchParams.get("card") ?? card.name ?? "").toLowerCase();
        if (!cardParam.includes("rayquaza")) continue;
      } catch {
        if (card.name && !/rayquaza/i.test(card.name)) continue;
      }
      uniqueCards.set(card.detailUrl, card);
      added += 1;
    }
    return added;
  };

  const initialCards = await extractListingCards(page);
  addCards(initialCards);
  console.log(`[ligapokemon] lote inicial: ${initialCards.length} links reais de cards`);

  const config = await extractAjaxConfig(page);
  let emptyPages = 0;

  for (let pageNumber = 2; pageNumber <= monitorConfig.sources.ligapokemon.maxVerMaisClicks + 1; pageNumber += 1) {
    await hooks?.onStageChange?.({
      source: "LIGA_POKEMON",
      stage: "EXPANDING_LIGA_LOAD_MORE",
      message: `Carregando lote ${pageNumber} da Liga Pokemon... ${uniqueCards.size} cards reais encontrados.`,
      totalCardsDiscovered: uniqueCards.size
    });

    await page.waitForTimeout(getRequestDelayMs());
    const html = await fetchLigaListingPage(page, config, pageNumber);
    const cards = html.length > 0 ? await extractListingCards(page, html) : [];
    const added = addCards(cards);

    console.log(`[ligapokemon] lote ${pageNumber}: ${cards.length} links de cards, ${added} novos, total ${uniqueCards.size}`);

    if (cards.length === 0 || added === 0) {
      emptyPages += 1;
      if (emptyPages >= 2) break;
      continue;
    }

    emptyPages = 0;
  }

  console.log(`[ligapokemon] listagem encerrada: ${uniqueCards.size} links reais de cards`);
  return Array.from(uniqueCards.values());
}

async function extractDetail(page: Page): Promise<LigaPokemonDetailRaw> {
  return page.evaluate(({ nameSelectors, imageSelectors }) => {
    const scope = globalThis as Record<string, unknown>;
    const cardsEditions = Array.isArray(scope.cards_editions) ? (scope.cards_editions as Array<Record<string, unknown>>) : [];
    const cardsStock = Array.isArray(scope.cards_stock) ? (scope.cards_stock as Array<Record<string, unknown>>) : [];
    const cardsStores =
      typeof scope.cards_stores === "object" && scope.cards_stores !== null
        ? (scope.cards_stores as Record<string, Record<string, unknown>>)
        : {};
    const languages = Array.isArray(scope.dataLanguage) ? (scope.dataLanguage as Array<Record<string, unknown>>) : [];
    const qualities = Array.isArray(scope.dataQuality) ? (scope.dataQuality as Array<Record<string, unknown>>) : [];
    const extras = Array.isArray(scope.dataExtras) ? (scope.dataExtras as Array<Record<string, unknown>>) : [];
    const primaryEdition = cardsEditions[0] ?? null;
    const cardFromUrl = new URL(location.href).searchParams.get("card");
    const urlDerivedName = cardFromUrl?.replace(/\s*\([^)]*\)\s*$/, "").trim() ?? null;
    const titleName = document.title.split("|")[0]?.split("/")[1]?.trim() ?? document.title.split("|")[0]?.trim() ?? null;
    let name: string | null = urlDerivedName;
    let imageUrl: string | null = null;

    if (primaryEdition && typeof primaryEdition.img === "string") {
      const image = primaryEdition.img as string;
      if (image.startsWith("//")) imageUrl = `${location.protocol}${image}`;
      else if (/^https?:\/\//i.test(image)) imageUrl = image;
      else imageUrl = new URL(image, location.origin).toString();
    }

    for (const selector of nameSelectors) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element?.textContent?.replace(/\s+/g, " ").trim();
      if (text && !/lista de compras/i.test(text) && (/rayquaza/i.test(text) || !name)) {
        name = text;
        break;
      }
    }

    if (!imageUrl) {
      for (const selector of imageSelectors) {
        const element = document.querySelector<HTMLImageElement>(selector);
        if (element?.src && !/logo|loading/i.test(element.src)) {
          imageUrl = element.src;
          break;
        }
      }
    }

    if (!name) name = urlDerivedName ?? titleName;

    const offers: LigaPokemonDetailRaw["offers"] = [];
    const priceKeys = [
      "precoFinal",
      "preco",
      "valorFinal",
      "valor",
      "priceFinal",
      "price",
      "precoVenda",
      "vl_preco",
      "vlPreco"
    ];

    function firstPresentValue(source: Record<string, unknown>, keys: string[]): unknown {
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
          return source[key];
        }
      }

      return null;
    }

    function parsePriceValue(value: unknown): number | null {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value !== "string") return null;

      const text = value.trim();
      if (!text) return null;
      const numeric = text.replace(/[^\d,.-]/g, "");
      if (!numeric) return null;
      const normalized =
        numeric.includes(",") && numeric.lastIndexOf(",") > numeric.lastIndexOf(".")
          ? numeric.replace(/\./g, "").replace(",", ".")
          : numeric.replace(/,/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    for (const stock of cardsStock) {
      const storeId = String(stock.lj_id ?? "");
      const store = cardsStores[storeId] ?? {};
      const offerId = String(stock.id ?? "");
      const rawPrice = firstPresentValue(stock, priceKeys);
      const rawQuantity = stock.quant;
      const rawLanguageId = Number(stock.idioma ?? Number.NaN);
      const rawQualityId = Number(stock.qualid ?? Number.NaN);
      const rawExtraId = Number(stock.extras ?? Number.NaN);

      let language: Record<string, unknown> | null = null;
      for (const entry of languages) {
        if (Number(entry.id ?? Number.NaN) === rawLanguageId) {
          language = entry;
          break;
        }
      }

      let quality: Record<string, unknown> | null = null;
      for (const entry of qualities) {
        if (Number(entry.id ?? Number.NaN) === rawQualityId) {
          quality = entry;
          break;
        }
      }

      let extra: Record<string, unknown> | null = null;
      for (const entry of extras) {
        if (Number(entry.id ?? Number.NaN) === rawExtraId) {
          extra = entry;
          break;
        }
      }

      const price = parsePriceValue(rawPrice);
      if (price === null) {
        continue;
      }

      let quantity: number | null = null;
      if (typeof rawQuantity === "number" && Number.isFinite(rawQuantity)) quantity = rawQuantity;
      else if (typeof rawQuantity === "string" && rawQuantity.trim().length > 0) {
        const parsedQuantity = Number(rawQuantity);
        if (Number.isFinite(parsedQuantity)) quantity = parsedQuantity;
      }

      const offerUrl =
        storeId && offerId
          ? `${location.origin}/?view=mp/showcase/home&id=${encodeURIComponent(storeId)}&tcg=${encodeURIComponent(offerId)}`
          : location.href;
      const finishText = typeof extra?.label === "string" ? extra.label : null;
      const qualityAcron = typeof quality?.acron === "string" ? quality.acron : null;
      const qualityLabel = typeof quality?.label === "string" ? quality.label : null;
      const conditionText = [qualityAcron, qualityLabel].filter(Boolean).join(" - ") || null;

      offers.push({
        sourceOfferId: offerId || null,
        priceText: typeof price === "number" ? `R$ ${price.toFixed(2).replace(".", ",")}` : null,
        languageText: typeof language?.label === "string" ? language.label : null,
        conditionText,
        finishText,
        sellerText: typeof store.lj_name === "string" ? store.lj_name : null,
        storeText: typeof store.lj_name === "string" ? store.lj_name : null,
        offerUrl,
        imageUrl,
        quantity,
        raw: { stock, store, language, quality, extra, finishText, rawPrice }
      });
    }

    let year: number | null = null;
    if (primaryEdition && typeof primaryEdition.date === "string") {
      const parsedYear = Number(primaryEdition.date.slice(0, 4));
      if (Number.isFinite(parsedYear) && parsedYear > 0) year = parsedYear;
    }

    return {
      name,
      setName: typeof primaryEdition?.name === "string" ? primaryEdition.name : null,
      setCode: typeof primaryEdition?.code === "string" ? primaryEdition.code : null,
      year,
      number: typeof primaryEdition?.num === "string" ? primaryEdition.num : null,
      rarity:
        primaryEdition && typeof primaryEdition.rarid === "object" && primaryEdition.rarid !== null
          ? String((primaryEdition.rarid as Record<string, unknown>).label ?? "")
          : null,
      imageUrl,
      offers,
      raw: { pageTitle: document.title, editionCount: cardsEditions.length, stockCount: cardsStock.length }
    };
  }, { nameSelectors: ligaPokemonSelectors.detailName, imageSelectors: ligaPokemonSelectors.detailImage });
}

async function saveFailureScreenshot(page: Page, name: string): Promise<string | null> {
  const screenshotDir = path.resolve(process.cwd(), "storage/screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const fileName = `ligapokemon-${Date.now()}-${slugifyText(name)}.png`;
  const filePath = path.join(screenshotDir, fileName);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return null;
  }
}

async function scrapeDetailCard(
  detailPage: Page,
  queuedCard: QueuedLigaCard
): Promise<ReturnType<typeof mapLigaPokemonCard>> {
  const requestDelayMs = getRequestDelayMs();

  await detailPage.goto(queuedCard.listing.detailUrl!, {
    waitUntil: "domcontentloaded",
    timeout: monitorConfig.monitor.cardDetailTimeoutMs
  });

  const hasGlobals = await detailPage.waitForFunction(
    () =>
      Array.isArray((globalThis as Record<string, unknown>).cards_editions) &&
      Array.isArray((globalThis as Record<string, unknown>).cards_stock),
    undefined,
    { timeout: Math.min(10_000, monitorConfig.monitor.cardDetailTimeoutMs) }
  ).then(() => true).catch(() => false);

  if (!hasGlobals) {
    await detailPage.waitForLoadState("networkidle", {
      timeout: Math.min(5_000, monitorConfig.monitor.cardDetailTimeoutMs)
    }).catch(() => undefined);
  }

  await detailPage.waitForTimeout(Math.min(300, requestDelayMs));
  await ensurePageEvaluateHelpers(detailPage);
  const detail = await extractDetail(detailPage);
  return mapLigaPokemonCard(queuedCard.listing, detail);
}

function mapListingFallbackCard(queuedCard: QueuedLigaCard): ReturnType<typeof mapLigaPokemonCard> {
  return mapLigaPokemonCard(queuedCard.listing, {
    name: queuedCard.listing.name,
    setName: queuedCard.listing.setName,
    setCode: queuedCard.listing.setCode,
    year: queuedCard.listing.year,
    number: queuedCard.listing.number,
    rarity: queuedCard.listing.rarity,
    imageUrl: queuedCard.listing.imageUrl,
    offers: [],
    raw: { fallbackFromListing: true }
  });
}

export async function scrapeLigaPokemon(hooks?: SourceScraperHooks): Promise<SourceScrapeResult> {
  const browser = await chromium.launch({
    headless: env.HEADLESS,
    slowMo: monitorConfig.delays.slowMo
  });
  const errors: string[] = [];

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(monitorConfig.monitor.cardDetailTimeoutMs);
    page.setDefaultNavigationTimeout(monitorConfig.monitor.cardDetailTimeoutMs);

    await hooks?.onStageChange?.({
      source: "LIGA_POKEMON",
      stage: "LOADING_LIGA_RESULTS",
      message: "Abrindo busca da Liga Pokemon..."
    });

    console.log("[ligapokemon] abrindo pagina de busca");
    await page.goto(monitorConfig.sources.ligapokemon.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await maybeAcceptPopup(page);
    await waitForListingCards(page);

    await hooks?.onStageChange?.({
      source: "LIGA_POKEMON",
      stage: "EXPANDING_LIGA_LOAD_MORE",
      message: "Expandindo resultados da Liga Pokemon..."
    });
    const listingCards = (await collectAllListingCards(page, hooks)).map((card) => ({
      ...card,
      sourceCardId: card.sourceCardId ?? extractCardIdFromUrl(card.detailUrl)
    }));

    const seenLinks = new Set<string>();
    const dedupedCards = listingCards.filter((card) => {
      if (!card.detailUrl || seenLinks.has(card.detailUrl)) return false;
      seenLinks.add(card.detailUrl);
      return true;
    });

    const { newCardsQueue, knownCardsQueue } = splitCardsByKnownState(dedupedCards);
    const queue = [...newCardsQueue, ...knownCardsQueue];
    const totalCards = queue.length;
    console.log(`[ligapokemon] cards novos: ${newCardsQueue.length}, conhecidos: ${knownCardsQueue.length}`);
    console.log(`[ligapokemon] ordem de processamento prioriza ${newCardsQueue.length} cards novos`);

    await hooks?.onStageChange?.({
      source: "LIGA_POKEMON",
      stage: "COLLECTING_LIGA_CARDS",
      message: `Lista da Liga Pokemon pronta com ${totalCards} cards.`,
      totalCardsDiscovered: totalCards,
      totalCards
    });

    const results: SourceScrapeResult["cards"] = [];
    let cursor = 0;
    let processedCards = 0;

    const workerCount = Math.max(1, Math.min(monitorConfig.monitor.detailConcurrency, totalCards || 1));

    async function worker(workerIndex: number): Promise<void> {
      const detailPage = await browser.newPage();
      detailPage.setDefaultTimeout(monitorConfig.monitor.cardDetailTimeoutMs);
      detailPage.setDefaultNavigationTimeout(monitorConfig.monitor.cardDetailTimeoutMs);

      try {
        while (true) {
          const currentIndex = cursor;
          const queuedCard = queue[currentIndex];
          if (!queuedCard) break;
          cursor += 1;

          const currentName = queuedCard.listing.name ?? "Rayquaza";
          await hooks?.onStageChange?.({
            source: "LIGA_POKEMON",
            stage: "SCRAPING_LIGA_CARD_DETAILS",
            message: `Coletando ofertas do card ${currentName} na Liga Pokemon...`,
            currentCardName: currentName,
            currentCardImageUrl: queuedCard.listing.imageUrl,
            processedCards,
            totalCards
          });

          try {
            const mappedCard = await scrapeDetailCard(detailPage, queuedCard);
            processedCards += 1;
            console.log(`[ligapokemon] worker ${workerIndex} -> ${mappedCard.name} (${mappedCard.offers.length} ofertas)`);
            results.push(mappedCard);
            await hooks?.onCardScraped?.(mappedCard, {
              source: "LIGA_POKEMON",
              processedCards,
              totalCards,
              cardIsNew: queuedCard.cardIsNew
            });
          } catch (error) {
            processedCards += 1;
            const fallbackCard = mapListingFallbackCard(queuedCard);
            results.push(fallbackCard);
            await hooks?.onCardScraped?.(fallbackCard, {
              source: "LIGA_POKEMON",
              processedCards,
              totalCards,
              cardIsNew: queuedCard.cardIsNew
            });
            const screenshotPath = await saveFailureScreenshot(detailPage, currentName);
            const message = error instanceof Error ? error.message : "Unknown Liga Pokemon detail error";
            errors.push(
              `[ligapokemon] falha ${queuedCard.listing.detailUrl}: ${message}${screenshotPath ? ` (screenshot: ${screenshotPath})` : ""}`
            );
            console.error(errors[errors.length - 1]);
          }

          await hooks?.onStageChange?.({
            source: "LIGA_POKEMON",
            stage: "SCRAPING_LIGA_CARD_DETAILS",
            message: `Liga Pokemon: ${processedCards}/${totalCards} cards processados.`,
            processedCards,
            totalCards
          });

          await detailPage.waitForTimeout(getRequestDelayMs());
        }
      } finally {
        await detailPage.close().catch(() => undefined);
      }
    }

    await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index + 1)));

    if (results.length === 0) {
      errors.push("[ligapokemon] nenhum card foi coletado");
    }

    const totalOffers = results.reduce((sum, card) => sum + card.offers.length, 0);
    console.log(`[ligapokemon] finalizou: ${results.length} cards, ${totalOffers} ofertas`);

    return {
      source: "LIGA_POKEMON",
      status: results.length > 0 ? (errors.length > 0 ? "partial" : "success") : "partial",
      cards: results,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Liga Pokemon scraper error";
    console.error(`[ligapokemon] erro fatal: ${message}`);
    return {
      source: "LIGA_POKEMON",
      status: "error",
      cards: [],
      errors: [message]
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
