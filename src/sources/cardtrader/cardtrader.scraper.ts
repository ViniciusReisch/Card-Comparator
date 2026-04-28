import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type APIRequestContext, type Page } from "playwright";
import { CardRepository } from "../../db/repositories/card.repository";
import { env } from "../../config/env";
import { monitorConfig } from "../../config/monitor.config";
import type { ScrapedCardSeed, SourceScrapeResult } from "../../domain/card.types";
import type { SourceScraperHooks } from "../../domain/scraper.types";
import { buildCanonicalCardKey } from "../../normalizers/offer-key";
import { slugifyText } from "../../normalizers/text-normalizer";
import {
  mapCardTraderCard,
  type CardTraderDetailRaw,
  type CardTraderListingRaw
} from "./cardtrader.mapper";

type CardTraderBlueprintPoolItem = {
  rid: number | string;
  id: string;
  n: string;
  x?: string;
  lx?: string;
  xx?: string;
  cn?: number | string | null;
};

type QueuedCardTraderCard = {
  listing: CardTraderListingRaw;
  cardIsNew: boolean;
};

const cardRepository = new CardRepository();

function getRequestDelayMs(): number {
  if (!monitorConfig.delays.fastMode) {
    return monitorConfig.delays.requestMs;
  }

  return Math.max(300, Math.round(monitorConfig.delays.requestMs * 0.35));
}

function extractCardIdFromUrl(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\/cards\/([^/?#]+)/i) ?? value.match(/\/products\/(\d+)/i) ?? value.match(/\/(\d+)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

function buildListingSeed(listing: CardTraderListingRaw): ScrapedCardSeed {
  return {
    source: "CARDTRADER",
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

function splitCardsByKnownState(cards: CardTraderListingRaw[]): {
  newCardsQueue: QueuedCardTraderCard[];
  knownCardsQueue: QueuedCardTraderCard[];
} {
  const newCardsQueue: QueuedCardTraderCard[] = [];
  const knownCardsQueue: QueuedCardTraderCard[] = [];

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

function decodeBlueprintIds(searchUrl: string): Set<number> {
  try {
    const url = new URL(searchUrl);
    const encodedIds = url.searchParams.get("ids");
    if (!encodedIds) return new Set();
    return new Set(
      Buffer.from(encodedIds, "base64")
        .toString("utf8")
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    );
  } catch {
    return new Set();
  }
}

function getSearchQuery(searchUrl: string): string | null {
  try {
    const url = new URL(searchUrl);
    return url.searchParams.get("q")?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

async function fetchListingCards(
  request: APIRequestContext,
  searchUrl: string
): Promise<CardTraderListingRaw[]> {
  const ids = decodeBlueprintIds(searchUrl);
  const query = getSearchQuery(searchUrl);
  const response = await request.get("https://www.cardtrader.com/en/manasearch/5/blueprints.json");

  if (!response.ok()) {
    throw new Error(`CardTrader blueprint pool request failed with status ${response.status()}`);
  }

  const pool = (await response.json()) as CardTraderBlueprintPoolItem[];
  const cards: CardTraderListingRaw[] = [];
  const seenUrls = new Set<string>();

  for (const entry of pool) {
    const rid = Number(entry.rid);
    const nameHaystack = (entry.n ?? "").toLowerCase();

    if (ids.size > 0 && !ids.has(rid)) continue;
    if (query && !nameHaystack.includes(query)) continue;
    if (!entry.id) continue;

    const detailUrl = `https://www.cardtrader.com/en/cards/${entry.id}`;
    if (seenUrls.has(detailUrl)) continue;

    seenUrls.add(detailUrl);
    cards.push({
      sourceCardId: Number.isFinite(rid) ? String(rid) : extractCardIdFromUrl(detailUrl),
      name: entry.n ?? null,
      setName: entry.lx ?? entry.x ?? null,
      setCode: entry.xx ?? null,
      year: null,
      number:
        typeof entry.cn === "number"
          ? String(entry.cn)
          : typeof entry.cn === "string"
            ? entry.cn
            : null,
      rarity: null,
      imageUrl: null,
      detailUrl,
      raw: { blueprintPool: entry }
    });
  }

  return cards;
}

async function extractDetail(page: Page): Promise<CardTraderDetailRaw> {
  return page.evaluate(() => {
    const appRoot = document.querySelector<HTMLElement>("[data-react-class='ProductsIndexApp']");
    const propsText = appRoot?.getAttribute("data-react-props");
    let props: Record<string, unknown> | null = null;

    if (propsText) {
      try {
        props = JSON.parse(propsText) as Record<string, unknown>;
      } catch {
        props = null;
      }
    }

    const blueprint =
      props && typeof props.blueprint === "object" && props.blueprint !== null
        ? (props.blueprint as Record<string, unknown>)
        : null;
    const expansion =
      blueprint && typeof blueprint.expansion === "object" && blueprint.expansion !== null
        ? (blueprint.expansion as Record<string, unknown>)
        : null;
    const properties =
      blueprint && typeof blueprint.properties_hash === "object" && blueprint.properties_hash !== null
        ? (blueprint.properties_hash as Record<string, unknown>)
        : null;

    let imageCandidate: string | null = null;
    if (blueprint && typeof blueprint.image_url === "string") {
      imageCandidate = blueprint.image_url;
    } else if (blueprint && typeof blueprint.image === "object" && blueprint.image !== null) {
      const image = blueprint.image as Record<string, unknown>;
      if (typeof image.url === "string") imageCandidate = image.url;
      else if (typeof image.show === "object" && image.show !== null) {
        const showImage = image.show as Record<string, unknown>;
        if (typeof showImage.url === "string") imageCandidate = showImage.url;
      }
    }

    let imageUrl: string | null = null;
    if (imageCandidate) {
      if (imageCandidate.startsWith("//")) imageUrl = `${location.protocol}${imageCandidate}`;
      else if (/^https?:\/\//i.test(imageCandidate)) imageUrl = imageCandidate;
      else imageUrl = new URL(imageCandidate, location.origin).toString();
    }

    function cleanText(value: string | null | undefined): string | null {
      const text = value?.replace(/\s+/g, " ").trim() ?? "";
      return text.length > 0 ? text : null;
    }

    function collectFinishCandidates(row: HTMLTableRowElement, descriptionText: string | null): string[] {
      const values: string[] = [];
      const finishPattern = /\b(reverse|foil|holo|etched|shattered|master\s*ball|poke\s*ball|pokeball|stamp(?:ed)?|staff|promo|pre\s*release|prerelease|1st|first\s*edition|shadowless|misprint|textless|signed|altered)\b/i;
      const push = (value: string | null | undefined) => {
        const text = cleanText(value);
        if (text && finishPattern.test(text) && !values.includes(text)) values.push(text);
      };

      push(descriptionText);

      for (const element of Array.from(row.querySelectorAll<HTMLElement>("[data-original-title], [title], [aria-label]"))) {
        push(element.getAttribute("data-original-title"));
        push(element.getAttribute("title"));
        push(element.getAttribute("aria-label"));
      }

      for (const element of Array.from(row.querySelectorAll<HTMLElement>("[class*='foil'], [class*='reverse'], [class*='holo'], [class*='icon'], .badge"))) {
        push(element.textContent);
      }

      return values;
    }

    const offers = Array.from(document.querySelectorAll<HTMLTableRowElement>("tr[data-product-id]")).map((row) => {
      const sellerAnchor = row.querySelector<HTMLAnchorElement>("td.products-table__seller a[href]");
      const sellerDesktop =
        sellerAnchor?.querySelector<HTMLElement>(".d-none.d-sm-inline-block")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const sellerMobile =
        sellerAnchor?.querySelector<HTMLElement>(".d-sm-none")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const sellerFallback = sellerAnchor?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const sellerText = sellerDesktop || sellerMobile || sellerFallback || null;

      const langCell = row.querySelector<HTMLElement>("td.products-table__info--language, td[class*='language']");
      const langElement =
        langCell?.querySelector<HTMLElement>("[data-original-title], [title], .flag-icon, [class*='flag'], span") ??
        row.querySelector<HTMLElement>(".products-table__info--language [data-original-title]") ??
        row.querySelector<HTMLElement>(".products-table__info--language .flag-icon");

      const languageText =
        langElement?.getAttribute("data-original-title") ??
        langElement?.getAttribute("title") ??
        langElement?.textContent?.replace(/\s+/g, " ").trim() ??
        langCell?.getAttribute("data-original-title") ??
        langCell?.getAttribute("title") ??
        null;

      const conditionElement = row.querySelector<HTMLElement>(
        ".products-table__info--condition [data-original-title], .products-table__info--condition .badge"
      );
      const conditionText =
        conditionElement?.getAttribute("data-original-title") ??
        conditionElement?.textContent?.replace(/\s+/g, " ").trim() ??
        null;

      const countryElement = row.querySelector<HTMLElement>("td.products-table__seller .flag-icon[data-original-title]");
      const descriptionElement = row.querySelector<HTMLElement>(".products-table__description small");
      const descriptionText =
        descriptionElement?.getAttribute("title") ??
        descriptionElement?.textContent?.replace(/\s+/g, " ").trim() ??
        null;
      const finishCandidates = collectFinishCandidates(row, descriptionText);
      const finishText = finishCandidates.length > 0 ? finishCandidates.join(" / ") : descriptionText;
      const priceElement = row.querySelector<HTMLElement>(".products-table__formatted-price");
      const quantityElement = row.querySelector<HTMLElement>(".input-group-text.products-table__quantity-form");
      const sourceOfferId = row.getAttribute("data-product-id");
      const rowId = row.id || (sourceOfferId ? `product-row-products-${sourceOfferId}` : "");
      const quantityText = quantityElement?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const quantityMatch = quantityText.match(/of\s*(\d+)/i);
      const fallbackQuantity = row.querySelectorAll(".products-table__quantity-form option").length;
      const quantity = quantityMatch
        ? Number(quantityMatch[1])
        : fallbackQuantity > 0
          ? fallbackQuantity
          : null;
      const rowLink =
        rowId.length > 0
          ? `${location.origin}${location.pathname}${location.search}#${rowId}`
          : sellerAnchor?.href ?? location.href;

      return {
        sourceOfferId,
        priceText: priceElement?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        languageText,
        conditionText,
        finishText,
        sellerText,
        sellerCountry: countryElement?.getAttribute("data-original-title") ?? null,
        storeText: sellerText,
        offerUrl: rowLink,
        imageUrl,
        quantity,
        raw: {
          rowId,
          descriptionText,
          finishCandidates,
          finishText,
          gtmPrice: row.getAttribute("gtm-price"),
          gtmCurrency: row.getAttribute("gtm-currency")
        }
      };
    });

    const releasedAt = typeof expansion?.released_at === "string" ? expansion.released_at : null;
    const yearMatch = releasedAt?.match(/\b(19|20)\d{2}\b/);

    return {
      name: typeof blueprint?.name === "string" ? blueprint.name : null,
      setName:
        typeof expansion?.translated_name === "string"
          ? expansion.translated_name
          : typeof expansion?.name === "string"
            ? expansion.name
            : null,
      setCode: typeof expansion?.code === "string" ? expansion.code : null,
      year: yearMatch ? Number(yearMatch[0]) : null,
      number: typeof properties?.collector_number === "string" ? properties.collector_number : null,
      rarity:
        typeof blueprint?.version === "string"
          ? blueprint.version
          : typeof properties?.pokemon_rarity === "string"
            ? properties.pokemon_rarity
            : null,
      imageUrl,
      offers: offers as CardTraderDetailRaw["offers"],
      raw: { pageTitle: document.title, blueprintId: blueprint?.id ?? null, rowCount: offers.length }
    };
  });
}

async function saveFailureScreenshot(page: Page, name: string): Promise<string | null> {
  const screenshotDir = path.resolve(process.cwd(), "storage/screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const fileName = `cardtrader-${Date.now()}-${slugifyText(name)}.png`;
  const filePath = path.join(screenshotDir, fileName);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return null;
  }
}

async function ensurePageEvaluateHelpers(page: Page): Promise<void> {
  await page.evaluate("globalThis.__name = globalThis.__name || ((target) => target);").catch(() => undefined);
}

async function scrapeDetailCard(page: Page, queuedCard: QueuedCardTraderCard): Promise<ReturnType<typeof mapCardTraderCard>> {
  await page.goto(queuedCard.listing.detailUrl!, {
    waitUntil: "domcontentloaded",
    timeout: monitorConfig.monitor.cardDetailTimeoutMs
  });
  await page.waitForSelector("[data-react-class='ProductsIndexApp']", {
    timeout: Math.min(10_000, monitorConfig.monitor.cardDetailTimeoutMs)
  });
  await page.waitForSelector("tr[data-product-id]", {
    timeout: Math.min(8_000, monitorConfig.monitor.cardDetailTimeoutMs)
  }).catch(() => undefined);
  await page.waitForTimeout(Math.min(150, getRequestDelayMs()));
  await ensurePageEvaluateHelpers(page);
  const detail = await extractDetail(page);
  return mapCardTraderCard(queuedCard.listing, detail);
}

function mapListingFallbackCard(queuedCard: QueuedCardTraderCard): ReturnType<typeof mapCardTraderCard> {
  return mapCardTraderCard(queuedCard.listing, {
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

export async function scrapeCardTrader(hooks?: SourceScraperHooks): Promise<SourceScrapeResult> {
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
      source: "CARDTRADER",
      stage: "LOADING_CARDTRADER_RESULTS",
      message: "Abrindo busca do CardTrader..."
    });

    console.log("[cardtrader] abrindo pagina de busca");
    await page.goto(monitorConfig.sources.cardtrader.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    await hooks?.onStageChange?.({
      source: "CARDTRADER",
      stage: "PAGINATING_CARDTRADER",
      message: "Resolvendo pool de cards do CardTrader..."
    });

    const listingCards = await fetchListingCards(page.context().request, monitorConfig.sources.cardtrader.searchUrl);
    console.log(`[cardtrader] ${listingCards.length} cards resolvidos do blueprint pool`);

    const { newCardsQueue, knownCardsQueue } = splitCardsByKnownState(listingCards);
    const queue = [...newCardsQueue, ...knownCardsQueue];
    const totalCards = queue.length;
    console.log(`[cardtrader] cards novos: ${newCardsQueue.length}, conhecidos: ${knownCardsQueue.length}`);
    console.log(`[cardtrader] ordem de processamento prioriza ${newCardsQueue.length} cards novos`);

    await hooks?.onStageChange?.({
      source: "CARDTRADER",
      stage: "COLLECTING_CARDTRADER_CARDS",
      message: `Lista do CardTrader pronta com ${totalCards} cards.`,
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
            source: "CARDTRADER",
            stage: "SCRAPING_CARDTRADER_CARD_DETAILS",
            message: `Coletando ofertas do card ${currentName} no CardTrader...`,
            currentCardName: currentName,
            currentCardImageUrl: queuedCard.listing.imageUrl,
            processedCards,
            totalCards
          });

          try {
            const mappedCard = await scrapeDetailCard(detailPage, queuedCard);
            processedCards += 1;
            console.log(`[cardtrader] worker ${workerIndex} -> ${mappedCard.name} (${mappedCard.offers.length} ofertas)`);
            results.push(mappedCard);
            await hooks?.onCardScraped?.(mappedCard, {
              source: "CARDTRADER",
              processedCards,
              totalCards,
              cardIsNew: queuedCard.cardIsNew
            });
          } catch (error) {
            processedCards += 1;
            const fallbackCard = mapListingFallbackCard(queuedCard);
            results.push(fallbackCard);
            await hooks?.onCardScraped?.(fallbackCard, {
              source: "CARDTRADER",
              processedCards,
              totalCards,
              cardIsNew: queuedCard.cardIsNew
            });
            const screenshotPath = await saveFailureScreenshot(detailPage, currentName);
            const message = error instanceof Error ? error.message : "Unknown CardTrader detail error";
            errors.push(
              `[cardtrader] falha ${queuedCard.listing.detailUrl}: ${message}${screenshotPath ? ` (screenshot: ${screenshotPath})` : ""}`
            );
            console.error(errors[errors.length - 1]);
          }

          await hooks?.onStageChange?.({
            source: "CARDTRADER",
            stage: "SCRAPING_CARDTRADER_CARD_DETAILS",
            message: `CardTrader: ${processedCards}/${totalCards} cards processados.`,
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
      errors.push("[cardtrader] nenhum card coletado");
    }

    const totalOffers = results.reduce((sum, card) => sum + card.offers.length, 0);
    console.log(`[cardtrader] finalizou: ${results.length} cards, ${totalOffers} ofertas`);

    return {
      source: "CARDTRADER",
      status: results.length > 0 ? (errors.length > 0 ? "partial" : "success") : "partial",
      cards: results,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CardTrader scraper error";
    console.error(`[cardtrader] erro fatal: ${message}`);
    return {
      source: "CARDTRADER",
      status: "error",
      cards: [],
      errors: [message]
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
