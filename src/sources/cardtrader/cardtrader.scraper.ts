import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { env } from "../../config/env";
import { monitorConfig } from "../../config/monitor.config";
import type { SourceScrapeResult } from "../../domain/card.types";
import { slugifyText } from "../../normalizers/text-normalizer";
import {
  mapCardTraderCard,
  type CardTraderDetailRaw,
  type CardTraderListingRaw
} from "./cardtrader.mapper";
import { cardTraderSelectors } from "./cardtrader.selectors";

function extractCardIdFromUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\/products\/(\d+)/i) ?? value.match(/\/(\d+)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

async function extractListingCards(page: Page): Promise<CardTraderListingRaw[]> {
  return page.evaluate(({ linkSelectors }) => {
    const links = new Map<string, HTMLAnchorElement>();

    for (const selector of linkSelectors) {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
      for (const anchor of anchors) {
        if (!anchor.href || links.has(anchor.href)) {
          continue;
        }

        const text = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const imageAlt = anchor.querySelector<HTMLImageElement>("img")?.alt ?? "";

        if (!/rayquaza/i.test(`${text} ${imageAlt}`) && !/rayquaza/i.test(anchor.href)) {
          continue;
        }

        links.set(anchor.href, anchor);
      }
    }

    return Array.from(links.values()).map((anchor) => {
      const container =
        anchor.closest("article, li, tr, .card, .product, .row, .col") ??
        anchor.parentElement ??
        anchor;
      const image = container.querySelector<HTMLImageElement>("img") ?? anchor.querySelector<HTMLImageElement>("img");
      const texts = Array.from(container.querySelectorAll("h1,h2,h3,h4,span,small,strong,p,div"))
        .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean)
        .slice(0, 30);

      return {
        sourceCardId: null,
        name: texts.find((value) => /rayquaza/i.test(value)) ?? image?.alt ?? anchor.textContent?.trim() ?? null,
        setName: texts.find((value) => !/rayquaza/i.test(value) && !/\b(19|20)\d{2}\b/.test(value)) ?? null,
        setCode: null,
        year: Number(texts.find((value) => /\b(19|20)\d{2}\b/.test(value))?.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0) || null,
        number: texts.find((value) => /#?\d{1,4}[A-Z]?/i.test(value)) ?? null,
        rarity: texts.find((value) => /rare|secret|promo|holo/i.test(value)) ?? null,
        imageUrl: image?.src ?? null,
        detailUrl: anchor.href,
        raw: {
          texts
        }
      };
    });
  }, { linkSelectors: cardTraderSelectors.listingCardLinks });
}

async function findNextPageUrl(page: Page): Promise<string | null> {
  for (const selector of cardTraderSelectors.nextPage) {
    const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
    if (href) {
      return new URL(href, page.url()).toString();
    }
  }

  const nextByText = await page.getByRole("link", { name: /next/i }).first().getAttribute("href").catch(() => null);
  return nextByText ? new URL(nextByText, page.url()).toString() : null;
}

async function extractDetail(page: Page): Promise<CardTraderDetailRaw> {
  return page.evaluate(({ nameSelectors, imageSelectors, offerSelectors }) => {
    const getFirstText = (selectors: readonly string[]): string | null => {
      for (const selector of selectors) {
        const element = document.querySelector<HTMLElement>(selector);
        const text = element?.textContent?.replace(/\s+/g, " ").trim();
        if (text) {
          return text;
        }
      }

      return null;
    };

    const getFirstImage = (selectors: readonly string[]): string | null => {
      for (const selector of selectors) {
        const element = document.querySelector<HTMLImageElement>(selector);
        if (element?.src) {
          return element.src;
        }
      }

      return null;
    };

    const pricePattern = /(R\$|\$|€)\s*[\d.,]+/i;
    const languagePattern =
      /\b(portugues|portuguese|pt|ingles|english|en|japanese|jp|spanish|es|italian|it|french|fr|german|de)\b/i;
    const conditionPattern =
      /\b(mint|near mint|slightly played|moderately played|played|heavily played|poor)\b/i;
    const countryPattern = /\b(italy|italia|spain|espana|germany|deutschland|france|brazil|brasil|portugal|japan|usa|united states|canada)\b/i;
    const uniqueOffers = new Map<string, Record<string, unknown>>();

    for (const selector of offerSelectors) {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(selector));
      for (const row of rows) {
        const text = row.textContent?.replace(/\s+/g, " ").trim() ?? "";

        if (!pricePattern.test(text)) {
          continue;
        }

        const links = Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"));
        const images = Array.from(row.querySelectorAll<HTMLImageElement>("img[src]"));
        const chunks = Array.from(row.querySelectorAll("td,th,span,strong,small,p,div,a"))
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
          .filter(Boolean)
          .slice(0, 25);

        const priceText = text.match(pricePattern)?.[0] ?? null;
        const languageText = chunks.find((chunk) => languagePattern.test(chunk)) ?? text.match(languagePattern)?.[0] ?? null;
        const conditionText = chunks.find((chunk) => conditionPattern.test(chunk)) ?? text.match(conditionPattern)?.[0] ?? null;
        const countryText = chunks.find((chunk) => countryPattern.test(chunk)) ?? text.match(countryPattern)?.[0] ?? null;
        const quantityChunk = chunks.find((chunk) => /\b(qty|quantity|available|stock)\b/i.test(chunk)) ?? null;
        const quantity = quantityChunk?.match(/\d+/)?.[0] ?? text.match(/\b(?:qty|quantity|available|stock)[:\s]*(\d+)/i)?.[1] ?? null;
        const sellerText =
          links.find((link) => link.textContent?.trim() && !pricePattern.test(link.textContent))?.textContent?.trim() ??
          chunks.find((chunk) => !pricePattern.test(chunk) && chunk !== languageText && chunk !== conditionText && chunk !== countryText) ??
          null;
        const storeText = row.querySelector<HTMLElement>("strong,b,h3,h4")?.textContent?.replace(/\s+/g, " ").trim() ?? sellerText;
        const offerUrl = links[0]?.href ?? null;
        const imageUrl = images[0]?.src ?? null;
        const sourceOfferId = offerUrl?.match(/\/offers\/(\d+)/i)?.[1] ?? offerUrl?.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
        const key = [offerUrl ?? "", sellerText ?? "", priceText ?? "", conditionText ?? "", languageText ?? ""].join("|");

        if (!uniqueOffers.has(key)) {
          uniqueOffers.set(key, {
            sourceOfferId,
            priceText,
            languageText,
            conditionText,
            sellerText,
            sellerCountry: countryText,
            storeText,
            offerUrl,
            imageUrl,
            quantity: quantity ? Number(quantity) : null,
            raw: {
              text,
              chunks
            }
          });
        }
      }
    }

    const bodyText = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

    return {
      name: getFirstText(nameSelectors),
      setName: bodyText.match(/(Scarlet.*?|Sword.*?|Sun.*?|XY.*?|Black.*?|Promo.*?)($|\s{2,})/i)?.[1] ?? null,
      setCode: bodyText.match(/\b[A-Z]{2,5}\d{0,3}\b/)?.[0] ?? null,
      year: Number(bodyText.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0) || null,
      number: bodyText.match(/(?:No\.?|Card Number|#)\s*([A-Z0-9/-]+)/i)?.[1] ?? null,
      rarity: bodyText.match(/\b(Common|Uncommon|Rare|Ultra Rare|Secret Rare|Promo)\b/i)?.[0] ?? null,
      imageUrl: getFirstImage(imageSelectors),
      offers: Array.from(uniqueOffers.values()) as CardTraderDetailRaw["offers"],
      raw: {
        pageTitle: document.title,
        bodyPreview: bodyText.slice(0, 2_000)
      }
    };
  }, {
    nameSelectors: cardTraderSelectors.detailName,
    imageSelectors: cardTraderSelectors.detailImage,
    offerSelectors: cardTraderSelectors.offerRows
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

export async function scrapeCardTrader(): Promise<SourceScrapeResult> {
  const browser = await chromium.launch({
    headless: env.HEADLESS,
    slowMo: monitorConfig.delays.slowMo
  });

  const errors: string[] = [];

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    console.log("[cardtrader] opening search page");

    await page.goto(monitorConfig.sources.cardtrader.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    const listingsByUrl = new Map<string, CardTraderListingRaw>();
    const visitedPageUrls = new Set<string>();
    let currentPageIndex = 1;

    while (currentPageIndex <= monitorConfig.sources.cardtrader.maxPages) {
      const currentUrl = page.url();
      if (visitedPageUrls.has(currentUrl)) {
        break;
      }

      visitedPageUrls.add(currentUrl);
      console.log(`[cardtrader] collecting list page ${currentPageIndex}`);

      const pageListings = (await extractListingCards(page)).map((card) => ({
        ...card,
        sourceCardId: card.sourceCardId ?? extractCardIdFromUrl(card.detailUrl)
      }));

      for (const listing of pageListings) {
        if (listing.detailUrl && !listingsByUrl.has(listing.detailUrl)) {
          listingsByUrl.set(listing.detailUrl, listing);
        }
      }

      const nextPageUrl = await findNextPageUrl(page);
      if (!nextPageUrl || nextPageUrl === currentUrl) {
        break;
      }

      await page.waitForTimeout(env.REQUEST_DELAY_MS);
      await page.goto(nextPageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      currentPageIndex += 1;
    }

    const results = [];

    for (const listing of listingsByUrl.values()) {
      if (!listing.detailUrl) {
        continue;
      }

      const detailPage = await browser.newPage();
      detailPage.setDefaultTimeout(15_000);

      try {
        console.log(`[cardtrader] scraping detail ${listing.detailUrl}`);
        await detailPage.goto(listing.detailUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000
        });
        await detailPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
        await detailPage.waitForTimeout(env.REQUEST_DELAY_MS);

        const detail = await extractDetail(detailPage);
        results.push(mapCardTraderCard(listing, detail));
      } catch (error) {
        const screenshotPath = await saveFailureScreenshot(detailPage, listing.name ?? "rayquaza");
        const message = error instanceof Error ? error.message : "Unknown CardTrader detail error";
        errors.push(
          `[cardtrader] failed card ${listing.detailUrl}: ${message}${screenshotPath ? ` (screenshot: ${screenshotPath})` : ""}`
        );
        console.error(errors[errors.length - 1]);
      } finally {
        await detailPage.close().catch(() => undefined);
      }
    }

    if (results.length === 0) {
      errors.push("[cardtrader] no cards were collected from the paginator");
    }

    return {
      source: "CARDTRADER",
      status: results.length > 0 ? (errors.length > 0 ? "partial" : "success") : "partial",
      cards: results,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CardTrader scraper error";
    console.error(`[cardtrader] fatal error: ${message}`);

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

