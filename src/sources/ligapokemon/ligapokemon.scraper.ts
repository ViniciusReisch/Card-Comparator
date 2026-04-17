import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
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

async function countCards(page: Page): Promise<number> {
  return page.evaluate(({ linkSelectors }) => {
    const seen = new Set<string>();
    for (const selector of linkSelectors) {
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(selector))) {
        if (anchor.href) seen.add(anchor.href);
      }
    }
    return seen.size;
  }, { linkSelectors: ligaPokemonSelectors.listingCardLinks });
}

async function findVisibleLoadMore(page: Page): Promise<Locator | null> {
  for (const selector of ligaPokemonSelectors.loadMoreButtons) {
    const locator = page.locator(selector).filter({ hasText: /ver mais/i }).first();
    if ((await locator.count()) === 0) continue;
    if (await locator.isVisible().catch(() => false)) return locator;
  }

  const byText = page.getByText(/ver mais/i).first();
  if ((await byText.count()) > 0 && (await byText.isVisible().catch(() => false))) {
    return byText;
  }

  return null;
}

async function extractListingCards(page: Page): Promise<LigaPokemonListingRaw[]> {
  return page.evaluate(({ linkSelectors }) => {
    const uniqueAnchors = new Map<string, HTMLAnchorElement>();
    for (const selector of linkSelectors) {
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(selector))) {
        if (!anchor.href || uniqueAnchors.has(anchor.href)) continue;
        uniqueAnchors.set(anchor.href, anchor);
      }
    }

    return Array.from(uniqueAnchors.values()).map((anchor) => {
      const container =
        anchor.closest("article, li, tr, .card, .row, .col, .box, .item") ??
        anchor.parentElement ??
        anchor;
      const image =
        container.querySelector<HTMLImageElement>("img") ??
        anchor.querySelector<HTMLImageElement>("img");
      const textChunks = Array.from(container.querySelectorAll("h1,h2,h3,h4,strong,span,small,p,div"))
        .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean)
        .slice(0, 30);
      const nameCandidate =
        anchor.getAttribute("title") ||
        image?.getAttribute("alt") ||
        textChunks.find((value) => /rayquaza/i.test(value)) ||
        anchor.textContent;
      const yearCandidate = textChunks.find((value) => /\b(19|20)\d{2}\b/.test(value)) ?? null;
      const numberCandidate = textChunks.find((value) => /#?\d{1,4}[A-Z]?/i.test(value)) ?? null;

      return {
        sourceCardId: null,
        name: nameCandidate ?? null,
        setName: textChunks.find((value) => !/rayquaza/i.test(value) && value !== yearCandidate) ?? null,
        setCode: null,
        year: yearCandidate ? Number(yearCandidate.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0) : null,
        number: numberCandidate,
        rarity: textChunks.find((value) => /rare|ultra|secret|promo|holo/i.test(value)) ?? null,
        imageUrl: image?.src ?? null,
        detailUrl: anchor.href,
        raw: { textChunks }
      };
    });
  }, { linkSelectors: ligaPokemonSelectors.listingCardLinks });
}

async function expandAllResults(page: Page, hooks?: SourceScraperHooks): Promise<void> {
  const maxClicks = monitorConfig.sources.ligapokemon.maxVerMaisClicks;
  const requestDelayMs = getRequestDelayMs();
  let stuckCount = 0;

  for (let clickIndex = 0; clickIndex < maxClicks; clickIndex += 1) {
    const countBefore = await countCards(page);
    await hooks?.onStageChange?.({
      source: "LIGA_POKEMON",
      stage: "EXPANDING_LIGA_LOAD_MORE",
      message: `Expandindo resultado da Liga Pokemon... ${countBefore} cards visiveis.`,
      totalCardsDiscovered: countBefore
    });

    const button = await findVisibleLoadMore(page);
    if (!button) {
      console.log(`[ligapokemon] botao 'Ver Mais' nao encontrado apos ${clickIndex} cliques. Total: ${countBefore} cards.`);
      break;
    }

    const isDisabled = await button.isDisabled().catch(() => false);
    if (isDisabled) {
      console.log(`[ligapokemon] botao 'Ver Mais' desabilitado. Total: ${countBefore} cards.`);
      break;
    }

    await button.scrollIntoViewIfNeeded().catch(() => undefined);

    let clicked = false;
    try {
      await button.click({ timeout: 5_000 });
      clicked = true;
    } catch {
      try {
        await button.evaluate((element) => { (element as HTMLElement).click(); });
        clicked = true;
      } catch {
        clicked = false;
      }
    }

    if (!clicked) {
      stuckCount += 1;
      if (stuckCount >= 3) {
        console.log(`[ligapokemon] nao foi possivel clicar em 'Ver Mais'. Total: ${countBefore} cards.`);
        break;
      }
      await page.waitForTimeout(requestDelayMs);
      continue;
    }

    await Promise.race([
      page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined),
      page.waitForFunction(
        ({ before, selectors }: { before: number; selectors: readonly string[] }) => {
          const seen = new Set<string>();
          for (const selector of selectors) {
            for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(selector))) {
              if (anchor.href) seen.add(anchor.href);
            }
          }
          return seen.size > before;
        },
        { before: countBefore, selectors: ligaPokemonSelectors.listingCardLinks },
        { timeout: Math.max(5_000, requestDelayMs) }
      ).catch(() => undefined),
      page.waitForTimeout(requestDelayMs)
    ]);

    const countAfter = await countCards(page);
    if (countAfter <= countBefore) {
      stuckCount += 1;
      if (stuckCount >= 3) {
        console.log(`[ligapokemon] sem aumento de cards apos ${stuckCount} tentativas. Total: ${countBefore} cards.`);
        break;
      }
    } else {
      stuckCount = 0;
      console.log(`[ligapokemon] clique ${clickIndex + 1}: ${countBefore} -> ${countAfter} cards`);
    }
  }
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

    for (const stock of cardsStock) {
      const storeId = String(stock.lj_id ?? "");
      const store = cardsStores[storeId] ?? {};
      const offerId = String(stock.id ?? "");
      const rawPrice = stock.precoFinal;
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

      let price: number | null = null;
      if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) price = rawPrice;
      else if (typeof rawPrice === "string" && rawPrice.trim().length > 0) {
        const parsedPrice = Number(rawPrice);
        if (Number.isFinite(parsedPrice)) price = parsedPrice;
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

      offers.push({
        sourceOfferId: offerId || null,
        priceText: typeof price === "number" ? `R$ ${price.toFixed(2).replace(".", ",")}` : null,
        languageText: typeof language?.label === "string" ? language.label : null,
        conditionText: typeof quality?.label === "string" ? quality.label : null,
        sellerText: typeof store.lj_name === "string" ? store.lj_name : null,
        storeText: typeof store.lj_name === "string" ? store.lj_name : null,
        offerUrl,
        imageUrl,
        quantity,
        raw: { stock, store, language, quality, extra }
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

  await detailPage.waitForTimeout(requestDelayMs);
  const detail = await extractDetail(detailPage);
  return mapLigaPokemonCard(queuedCard.listing, detail);
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

    await hooks?.onStageChange?.({
      source: "LIGA_POKEMON",
      stage: "EXPANDING_LIGA_LOAD_MORE",
      message: "Expandindo resultados da Liga Pokemon..."
    });
    await expandAllResults(page, hooks);

    const listingCards = (await extractListingCards(page)).map((card) => ({
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
