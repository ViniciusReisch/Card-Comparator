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
  if (!value) {
    return null;
  }

  const fromQuery = value.match(/[?&](?:id|card|cardid)=([^&#]+)/i);
  if (fromQuery) {
    return decodeURIComponent(fromQuery[1]);
  }

  const fromPath = value.match(/\/(\d+)(?:[/?#]|$)/);
  return fromPath?.[1] ?? null;
}

async function maybeAcceptPopup(page: Page): Promise<void> {
  const buttons = [
    /aceitar/i,
    /entendi/i,
    /ok/i,
    /fechar/i,
    /continuar/i,
    /prosseguir/i
  ];

  for (const name of buttons) {
    const button = page.getByRole("button", { name }).first();

    if ((await button.count()) === 0) {
      continue;
    }

    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
    }
  }
}

async function findVisibleLoadMore(page: Page): Promise<Locator | null> {
  for (const selector of ligaPokemonSelectors.loadMoreButtons) {
    const locator = page.locator(selector).filter({ hasText: /ver mais/i }).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
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
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
      for (const anchor of anchors) {
        if (!anchor.href || uniqueAnchors.has(anchor.href)) {
          continue;
        }

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
        raw: {
          textChunks
        }
      };
    });
  }, { linkSelectors: ligaPokemonSelectors.listingCardLinks });
}

async function expandAllResults(page: Page): Promise<void> {
  for (let clickIndex = 0; clickIndex < monitorConfig.sources.ligapokemon.maxVerMaisClicks; clickIndex += 1) {
    const countBefore = (await extractListingCards(page)).length;
    const button = await findVisibleLoadMore(page);

    if (!button) {
      break;
    }

    const isDisabled = await button.isDisabled().catch(() => false);
    if (isDisabled) {
      break;
    }

    await button.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(env.REQUEST_DELAY_MS);

    const countAfter = (await extractListingCards(page)).length;
    if (countAfter <= countBefore) {
      break;
    }
  }
}

async function extractDetail(page: Page): Promise<LigaPokemonDetailRaw> {
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
      /\b(portugues|portuguese|pt|ingles|english|en|japones|japanese|jp|espanhol|spanish|italiano|italian|frances|french|alemao|german)\b/i;
    const conditionPattern =
      /\b(mint|near mint|excellent|slightly played|moderately played|played|heavily played|poor|damaged|novo|seminovo|usado|jogado|danificado)\b/i;

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
          .slice(0, 20);

        const priceText = text.match(pricePattern)?.[0] ?? null;
        const languageText = chunks.find((chunk) => languagePattern.test(chunk)) ?? text.match(languagePattern)?.[0] ?? null;
        const conditionText = chunks.find((chunk) => conditionPattern.test(chunk)) ?? text.match(conditionPattern)?.[0] ?? null;
        const quantityChunk = chunks.find((chunk) => /\b(qtd|quantidade|disponivel|estoque)\b/i.test(chunk)) ?? null;
        const quantityMatch = quantityChunk?.match(/\d+/)?.[0] ?? text.match(/\b(?:qtd|quantidade|disponivel|estoque)[:\s]*(\d+)/i)?.[1] ?? null;
        const sellerText =
          links.find((link) => link.textContent?.trim() && !pricePattern.test(link.textContent))?.textContent?.trim() ??
          chunks.find((chunk) => !pricePattern.test(chunk) && chunk !== languageText && chunk !== conditionText) ??
          null;
        const storeText =
          row.querySelector<HTMLElement>("strong,b,h3,h4")?.textContent?.replace(/\s+/g, " ").trim() ??
          sellerText;
        const offerUrl = links[0]?.href ?? null;
        const imageUrl = images[0]?.src ?? null;
        const sourceOfferId = offerUrl?.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
        const key = [offerUrl ?? "", sellerText ?? "", priceText ?? "", conditionText ?? "", languageText ?? ""].join("|");

        if (!uniqueOffers.has(key)) {
          uniqueOffers.set(key, {
            sourceOfferId,
            priceText,
            languageText,
            conditionText,
            sellerText,
            storeText,
            offerUrl,
            imageUrl,
            quantity: quantityMatch ? Number(quantityMatch) : null,
            raw: {
              text,
              chunks
            }
          });
        }
      }
    }

    const pageText = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

    return {
      name: getFirstText(nameSelectors),
      setName: pageText.match(/(Scarlet.*?|Sword.*?|Sun.*?|XY.*?|Black.*?|Promo.*?)($|\s{2,})/i)?.[1] ?? null,
      setCode: pageText.match(/\b[A-Z]{2,5}\d{0,3}\b/)?.[0] ?? null,
      year: Number(pageText.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0) || null,
      number: pageText.match(/(?:No\.?|Numero|#)\s*([A-Z0-9/-]+)/i)?.[1] ?? null,
      rarity: pageText.match(/\b(Common|Uncommon|Rare|Ultra Rare|Secret Rare|Promo)\b/i)?.[0] ?? null,
      imageUrl: getFirstImage(imageSelectors),
      offers: Array.from(uniqueOffers.values()) as LigaPokemonDetailRaw["offers"],
      raw: {
        pageTitle: document.title,
        bodyPreview: pageText.slice(0, 2_000)
      }
    };
  }, {
    nameSelectors: ligaPokemonSelectors.detailName,
    imageSelectors: ligaPokemonSelectors.detailImage,
    offerSelectors: ligaPokemonSelectors.offerRows
  });
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
    page.setDefaultTimeout(15_000);

    console.log("[ligapokemon] opening search page");
    await page.goto(monitorConfig.sources.ligapokemon.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    await maybeAcceptPopup(page);
    await expandAllResults(page);

    const listingCards = (await extractListingCards(page)).map((card) => ({
      ...card,
      sourceCardId: card.sourceCardId ?? extractCardIdFromUrl(card.detailUrl)
    }));

    const results = [];

    for (const listingCard of listingCards) {
      if (!listingCard.detailUrl) {
        continue;
      }

      const detailPage = await browser.newPage();
      detailPage.setDefaultTimeout(15_000);

      try {
        console.log(`[ligapokemon] scraping detail ${listingCard.detailUrl}`);
        await detailPage.goto(listingCard.detailUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000
        });
        await detailPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
        await detailPage.waitForTimeout(env.REQUEST_DELAY_MS);

        const detail = await extractDetail(detailPage);
        results.push(mapLigaPokemonCard(listingCard, detail));
      } catch (error) {
        const screenshotPath = await saveFailureScreenshot(detailPage, listingCard.name ?? "rayquaza");
        const message = error instanceof Error ? error.message : "Unknown Liga Pokemon detail error";
        errors.push(
          `[ligapokemon] failed card ${listingCard.detailUrl}: ${message}${screenshotPath ? ` (screenshot: ${screenshotPath})` : ""}`
        );
        console.error(errors[errors.length - 1]);
      } finally {
        await detailPage.close().catch(() => undefined);
      }
    }

    if (results.length === 0) {
      errors.push("[ligapokemon] no cards were collected from the search results");
    }

    return {
      source: "LIGA_POKEMON",
      status: results.length > 0 ? (errors.length > 0 ? "partial" : "success") : "partial",
      cards: results,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Liga Pokemon scraper error";
    console.error(`[ligapokemon] fatal error: ${message}`);

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

