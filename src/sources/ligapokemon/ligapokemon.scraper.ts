import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { env } from "../../config/env";
import { monitorConfig } from "../../config/monitor.config";
import type { SourceScrapeResult } from "../../domain/card.types";
import { slugifyText } from "../../normalizers/text-normalizer";
import {
  mapLigaPokemonCard,
  type LigaPokemonDetailRaw,
  type LigaPokemonListingRaw
} from "./ligapokemon.mapper";
import { ligaPokemonSelectors } from "./ligapokemon.selectors";

function extractCardIdFromUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const card = url.searchParams.get("card");
    const edition = url.searchParams.get("ed");
    const number = url.searchParams.get("num");
    const composite = [card, edition, number].filter((p) => p && p.length > 0).join("|");
    if (composite.length > 0) return composite;
  } catch {
    // ignore
  }

  const fromQuery = value.match(/[?&](?:id|card|cardid)=([^&#]+)/i);
  if (fromQuery) return decodeURIComponent(fromQuery[1] ?? "");

  const fromPath = value.match(/\/(\d+)(?:[/?#]|$)/);
  return fromPath?.[1] ?? null;
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
    for (const sel of linkSelectors) {
      for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>(sel))) {
        if (a.href) seen.add(a.href);
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
        .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean)
        .slice(0, 30);
      const nameCandidate =
        anchor.getAttribute("title") ||
        image?.getAttribute("alt") ||
        textChunks.find((v) => /rayquaza/i.test(v)) ||
        anchor.textContent;
      const yearCandidate = textChunks.find((v) => /\b(19|20)\d{2}\b/.test(v)) ?? null;
      const numberCandidate = textChunks.find((v) => /#?\d{1,4}[A-Z]?/i.test(v)) ?? null;

      return {
        sourceCardId: null,
        name: nameCandidate ?? null,
        setName: textChunks.find((v) => !/rayquaza/i.test(v) && v !== yearCandidate) ?? null,
        setCode: null,
        year: yearCandidate ? Number(yearCandidate.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0) : null,
        number: numberCandidate,
        rarity: textChunks.find((v) => /rare|ultra|secret|promo|holo/i.test(v)) ?? null,
        imageUrl: image?.src ?? null,
        detailUrl: anchor.href,
        raw: { textChunks }
      };
    });
  }, { linkSelectors: ligaPokemonSelectors.listingCardLinks });
}

async function expandAllResults(page: Page): Promise<void> {
  const maxClicks = monitorConfig.sources.ligapokemon.maxVerMaisClicks;
  let stuckCount = 0;

  for (let clickIndex = 0; clickIndex < maxClicks; clickIndex += 1) {
    const countBefore = await countCards(page);
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

    // Scroll into view before clicking
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);

    // Try standard click
    let clicked = false;
    try {
      await button.click({ timeout: 5_000 });
      clicked = true;
    } catch {
      // Try via evaluate as fallback
      try {
        await button.evaluate((el) => { (el as HTMLElement).click(); });
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
      await page.waitForTimeout(env.REQUEST_DELAY_MS);
      continue;
    }

    // Wait for network or DOM change
    await Promise.race([
      page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined),
      page.waitForTimeout(env.REQUEST_DELAY_MS)
    ]);

    const countAfter = await countCards(page);
    if (countAfter <= countBefore) {
      stuckCount += 1;
      if (stuckCount >= 3) {
        console.log(`[ligapokemon] sem aumento de cards apos ${stuckCount} tentativas. Total: ${countBefore} cards.`);
        break;
      }
      await page.waitForTimeout(env.REQUEST_DELAY_MS * 2);
    } else {
      stuckCount = 0;
      console.log(`[ligapokemon] clique ${clickIndex + 1}: ${countBefore} → ${countAfter} cards`);
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
      const img = primaryEdition.img as string;
      if (img.startsWith("//")) imageUrl = `${location.protocol}${img}`;
      else if (/^https?:\/\//i.test(img)) imageUrl = img;
      else imageUrl = new URL(img, location.origin).toString();
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
        if (Number(entry.id ?? Number.NaN) === rawLanguageId) { language = entry; break; }
      }

      let quality: Record<string, unknown> | null = null;
      for (const entry of qualities) {
        if (Number(entry.id ?? Number.NaN) === rawQualityId) { quality = entry; break; }
      }

      let extra: Record<string, unknown> | null = null;
      for (const entry of extras) {
        if (Number(entry.id ?? Number.NaN) === rawExtraId) { extra = entry; break; }
      }

      let price: number | null = null;
      if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) price = rawPrice;
      else if (typeof rawPrice === "string" && rawPrice.trim().length > 0) {
        const p = Number(rawPrice);
        if (Number.isFinite(p)) price = p;
      }

      let quantity: number | null = null;
      if (typeof rawQuantity === "number" && Number.isFinite(rawQuantity)) quantity = rawQuantity;
      else if (typeof rawQuantity === "string" && rawQuantity.trim().length > 0) {
        const q = Number(rawQuantity);
        if (Number.isFinite(q)) quantity = q;
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

export async function scrapeLigaPokemon(): Promise<SourceScrapeResult> {
  const browser = await chromium.launch({
    headless: env.HEADLESS,
    slowMo: monitorConfig.delays.slowMo
  });
  const errors: string[] = [];

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);

    console.log("[ligapokemon] abrindo pagina de busca");
    await page.goto(monitorConfig.sources.ligapokemon.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await maybeAcceptPopup(page);

    const initialCount = await countCards(page);
    console.log(`[ligapokemon] cards iniciais: ${initialCount}`);
    await expandAllResults(page);

    const listingCards = (await extractListingCards(page)).map((card) => ({
      ...card,
      sourceCardId: card.sourceCardId ?? extractCardIdFromUrl(card.detailUrl)
    }));

    // Deduplicate by detailUrl
    const seen = new Set<string>();
    const dedupedCards = listingCards.filter((c) => {
      if (!c.detailUrl || seen.has(c.detailUrl)) return false;
      seen.add(c.detailUrl);
      return true;
    });

    console.log(`[ligapokemon] total de cards unicos coletados: ${dedupedCards.length}`);
    const results = [];

    for (const listingCard of dedupedCards) {
      if (!listingCard.detailUrl) continue;

      const detailPage = await browser.newPage();
      detailPage.setDefaultTimeout(20_000);

      try {
        console.log(`[ligapokemon] scraping ${listingCard.detailUrl}`);
        await detailPage.goto(listingCard.detailUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000
        });

        const hasGlobals = await detailPage.waitForFunction(
          () =>
            Array.isArray((globalThis as Record<string, unknown>).cards_editions) &&
            Array.isArray((globalThis as Record<string, unknown>).cards_stock),
          undefined,
          { timeout: 10_000 }
        ).then(() => true).catch(() => false);

        if (!hasGlobals) {
          await detailPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
        }

        await detailPage.waitForTimeout(env.REQUEST_DELAY_MS);

        const detail = await extractDetail(detailPage);
        console.log(`[ligapokemon] ${listingCard.detailUrl?.split("?")[1] ?? "?"} → ${detail.offers.length} ofertas`);
        results.push(mapLigaPokemonCard(listingCard, detail));
      } catch (error) {
        const screenshotPath = await saveFailureScreenshot(detailPage, listingCard.name ?? "rayquaza");
        const message = error instanceof Error ? error.message : "Unknown Liga Pokemon detail error";
        errors.push(
          `[ligapokemon] falha ${listingCard.detailUrl}: ${message}${screenshotPath ? ` (screenshot: ${screenshotPath})` : ""}`
        );
        console.error(errors[errors.length - 1]);
      } finally {
        await detailPage.close().catch(() => undefined);
      }
    }

    if (results.length === 0) {
      errors.push("[ligapokemon] nenhum card foi coletado");
    }

    const totalOffers = results.reduce((s, r) => s + r.offers.length, 0);
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
    return { source: "LIGA_POKEMON", status: "error", cards: [], errors: [message] };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
