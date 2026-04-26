import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CardRepository } from "../../db/repositories/card.repository";
import type { ScrapedCardSeed, SourceScrapeResult } from "../../domain/card.types";
import type { SourceScraperHooks } from "../../domain/scraper.types";
import { buildCanonicalCardKey } from "../../normalizers/offer-key";
import { slugifyText } from "../../normalizers/text-normalizer";
import { env } from "../../config/env";
import { monitorConfig } from "../../config/monitor.config";
import {
  mapMypCardsCard,
  type MypCardsDetailRaw,
  type MypCardsListingRaw,
  type MypCardsOfferRaw
} from "./mypcards.mapper";
import { mypCardsSelectors } from "./mypcards.selectors";

type QueuedMypCard = {
  listing: MypCardsListingRaw;
  cardIsNew: boolean;
};

const cardRepository = new CardRepository();

const BASE_URL = "https://mypcards.com";
const SEARCH_URL =
  `${BASE_URL}/pokemon?ProdutoSearch%5Bmarca%5D=pokemon&ProdutoSearch%5Bquery%5D=Rayquaza&page=`;

async function createMypBrowserContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });
}

function getRequestDelayMs(): number {
  if (!monitorConfig.delays.fastMode) {
    return monitorConfig.mypcards.requestDelayMs;
  }

  return Math.max(350, Math.round(monitorConfig.mypcards.requestDelayMs * 0.4));
}

function extractCardIdFromUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const id = url.searchParams.get("id");
    if (id) return id;
    const segments = url.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.length > 0) return lastSegment;
  } catch {
    // ignore invalid urls
  }

  const fromPath = value.match(/\/(\d+)(?:[/?#]|$)/);
  return fromPath?.[1] ?? null;
}

function buildListingSeed(listing: MypCardsListingRaw): ScrapedCardSeed {
  return {
    source: "MYPCARDS",
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

async function ensureEvaluateHelpers(page: Page): Promise<void> {
  await page
    .evaluate("globalThis.__name = (value) => value")
    .catch(() => undefined);
}

function splitCardsByKnownState(cards: MypCardsListingRaw[]): {
  newCardsQueue: QueuedMypCard[];
  knownCardsQueue: QueuedMypCard[];
} {
  const newCardsQueue: QueuedMypCard[] = [];
  const knownCardsQueue: QueuedMypCard[] = [];

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

async function extractListingCards(
  page: Page,
  pageUrl: string
): Promise<MypCardsListingRaw[]> {
  return page.evaluate(
    ({ selectors, baseUrl, pageUrl: currentPageUrl }) => {
      const __name = (value: unknown) => value;

      function absoluteUrl(value: string | null): string | null {
        if (!value) return null;
        try {
          return new URL(value, currentPageUrl).href;
        } catch {
          return null;
        }
      }

      function cleanText(value: string | null | undefined): string | null {
        const text = value?.replace(/\s+/g, " ").trim() ?? "";
        return text.length > 0 ? text : null;
      }

      function firstText(container: Element, sels: string[]): string | null {
        for (const sel of sels) {
          const el = container.querySelector<HTMLElement>(sel);
          const text = cleanText(el?.textContent);
          if (text) return text;
        }
        return null;
      }

      function firstAttr(container: Element, sels: string[], attr: string): string | null {
        for (const sel of sels) {
          const el = container.querySelector<HTMLElement>(sel);
          const val = el?.getAttribute(attr);
          if (val?.trim()) return val.trim();
        }
        return null;
      }

      function backgroundImageUrl(value: string | null): string | null {
        const match = value?.match(/url\((['"]?)(.*?)\1\)/i);
        return match?.[2] ?? null;
      }

      function betterMypImageUrl(value: string | null): string | null {
        if (!value) return null;
        return value
          .replace(/_thumb(\.[a-z]+)$/i, "$1")
          .replace("/cdn-cgi/image/h=425,fit=contain,f=auto//", "/");
      }

      function bestListingImage(container: Element): string | null {
        const lazy = container.querySelector<HTMLElement>(".card-img-link .lazy-bg, .lazy-bg[data-src]");
        const fromLazy =
          lazy?.getAttribute("data-src") ??
          backgroundImageUrl(lazy?.getAttribute("style") ?? null);

        if (fromLazy && !/forma|placeholder|heart|logo/i.test(fromLazy)) {
          return absoluteUrl(betterMypImageUrl(fromLazy));
        }

        const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
        for (const image of images) {
          const rawImageUrl =
            image.getAttribute("src") ??
            image.getAttribute("data-src") ??
            image.getAttribute("data-original");
          if (rawImageUrl && !/forma|placeholder|heart|logo|adicionar/i.test(rawImageUrl)) {
            return absoluteUrl(betterMypImageUrl(rawImageUrl));
          }
        }

        return null;
      }

      function parseCardNumber(value: string | null): string | null {
        const match = value?.match(/\(([^)]+)\)/);
        return cleanText(match?.[1]);
      }

      function isMypPokemonCardDetailUrl(value: string | null): boolean {
        if (!value) return false;
        try {
          const url = new URL(value);
          return url.origin === baseUrl && /^\/pokemon\/produto\/\d+\//i.test(url.pathname);
        } catch {
          return false;
        }
      }

      function hasStock(container: Element, sels: string[]): boolean {
        for (const sel of sels) {
          const el = container.querySelector<HTMLElement>(sel);
          if (!el) continue;
          const text = cleanText(el.textContent);
          if (!text) continue;
          const num = parseInt(text.replace(/\D/g, ""), 10);
          if (!isNaN(num) && num > 0) return true;
          if (/dispon|em estoque|disponivel/i.test(text)) return true;
        }
        return false;
      }

      const results: Array<{
        sourceCardId: string | null;
        name: string | null;
        setName: string | null;
        setCode: string | null;
        year: number | null;
        number: string | null;
        rarity: string | null;
        imageUrl: string | null;
        detailUrl: string | null;
        quantity: number | null;
        priceText: string | null;
        raw: Record<string, unknown>;
      }> = [];

      const seen = new Set<string>();

      // Try each listing item selector in order
      for (const itemSel of selectors.listingItems) {
        const items = Array.from(document.querySelectorAll<HTMLElement>(itemSel));
        if (items.length === 0) continue;

        for (const item of items) {
          // Find detail link
          let detailUrl: string | null = null;
          for (const linkSel of selectors.listingItemLink) {
            const anchor = item.querySelector<HTMLAnchorElement>(linkSel);
            const href = anchor?.getAttribute("href");
            const abs = absoluteUrl(href ?? null);
            if (abs && abs.startsWith(baseUrl)) {
              detailUrl = abs;
              break;
            }
          }

          if (!detailUrl || seen.has(detailUrl)) continue;

          const offerAnchor = item.querySelector<HTMLAnchorElement>("a.bt-offers[href*='/pokemon/produto/']");
          const offerText = cleanText(offerAnchor?.textContent);
          const strictDetailUrl = absoluteUrl(offerAnchor?.getAttribute("href") ?? null);
          if (
            !offerAnchor ||
            !strictDetailUrl ||
            !/ver ofertas/i.test(offerText ?? "") ||
            !isMypPokemonCardDetailUrl(strictDetailUrl)
          ) {
            continue;
          }
          detailUrl = strictDetailUrl;

          const imageAlt = cleanText(
            item.querySelector<HTMLElement>(".lazy-bg")?.getAttribute("alt") ??
              item.querySelector<HTMLImageElement>("img[alt]")?.getAttribute("alt")
          );
          const itemText = cleanText(item.textContent);
          const searchableText = [itemText, imageAlt, detailUrl].filter(Boolean).join(" ");
          if (!/rayquaza/i.test(searchableText)) continue;

          // Check if item actually has stock (offers available)
          const hasOffers =
            hasStock(item, selectors.listingItemQty) ||
            item.querySelector("a.bt-offers[href*='/pokemon/produto/']") !== null ||
            item.querySelector("a[href*='oferta'], a[href*='ver-oferta'], .btn-ver-ofertas") !== null ||
            !!item.querySelector<HTMLElement>(".ver-ofertas, .btn-comprar");

          if (!hasOffers) {
            // Still include if we're not sure — let the detail page decide
            const qtyText = firstText(item, selectors.listingItemQty);
            if (qtyText && /0\s*(unid|un\b|disp)/i.test(qtyText)) continue;
          }

          seen.add(detailUrl);

          const name = firstText(item, selectors.listingItemName) ?? cleanText(item.querySelector("a")?.textContent);
          const setName = firstText(item, selectors.listingItemSet);
          const qtyText = firstText(item, selectors.listingItemQty);
          const priceText = firstText(item, selectors.listingItemPrice);
          const yearMatch = item.textContent?.match(/\b(20\d{2})\b/);

          const qty = qtyText ? parseInt(qtyText.replace(/\D/g, ""), 10) : null;

          results.push({
            sourceCardId: item.getAttribute("data-key"),
            name,
            setName,
            setCode: firstAttr(item, selectors.listingItemSet, "data-code") ?? setName,
            year: yearMatch ? Number(yearMatch[1]) : null,
            number: parseCardNumber(name),
            rarity: null,
            imageUrl: bestListingImage(item),
            detailUrl,
            quantity: isNaN(qty ?? NaN) ? null : (qty ?? null),
            priceText,
            raw: {
              listingText: cleanText(item.textContent),
              pageUrl: currentPageUrl
            }
          });
        }

        if (results.length > 0) break;
      }

      return results;
    },
    {
      selectors: {
        listingItems: [...mypCardsSelectors.listingItems],
        listingItemLink: [...mypCardsSelectors.listingItemLink],
        listingItemName: [...mypCardsSelectors.listingItemName],
        listingItemSet: [...mypCardsSelectors.listingItemSet],
        listingItemQty: [...mypCardsSelectors.listingItemQty],
        listingItemPrice: [...mypCardsSelectors.listingItemPrice]
      },
      baseUrl: BASE_URL,
      pageUrl
    }
  );
}

async function collectAllListingCards(
  browser: Browser,
  hooks?: SourceScraperHooks
): Promise<MypCardsListingRaw[]> {
  const uniqueCards = new Map<string, MypCardsListingRaw>();
  const pageSignatures = new Set<string>();
  const maxPages = monitorConfig.mypcards.maxPages;
  let stopReason = `atingiu MYP_MAX_PAGES=${maxPages}`;

  const addCards = (cards: MypCardsListingRaw[]) => {
    let added = 0;
    for (const card of cards) {
      if (!card.detailUrl || uniqueCards.has(card.detailUrl)) continue;
      uniqueCards.set(card.detailUrl, card);
      added += 1;
    }
    return added;
  };

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const pageUrl = `${SEARCH_URL}${pageNum}`;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    await hooks?.onStageChange?.({
      source: "MYPCARDS",
      stage: "PAGINATING_MYPCARDS",
      message: `MYP Cards: carregando página ${pageNum}... (${uniqueCards.size} cards encontrados)`,
      totalCardsDiscovered: uniqueCards.size
    });

    console.log(`[mypcards] carregando página ${pageNum}: ${pageUrl}`);

    try {
      context = await createMypBrowserContext(browser);
      page = await context.newPage();
      page.setDefaultTimeout(monitorConfig.mypcards.cardTimeoutMs);
      page.setDefaultNavigationTimeout(monitorConfig.mypcards.cardTimeoutMs);

      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: monitorConfig.mypcards.cardTimeoutMs });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[mypcards] página ${pageNum} falhou ao carregar: ${msg}`);
      await context?.close().catch(() => undefined);
      if (pageNum === 1) throw error;
      stopReason = `pagina ${pageNum} falhou ao carregar`;
      break;
    }

    if (!page) {
      await context?.close().catch(() => undefined);
      stopReason = `pagina ${pageNum} nao abriu contexto de navegador`;
      break;
    }

    await ensureEvaluateHelpers(page);
    const cards = await extractListingCards(page, pageUrl);
    await context?.close().catch(() => undefined);

    const pageSignature = cards.map((card) => card.detailUrl).filter(Boolean).sort().join("|");
    if (pageSignature && pageSignatures.has(pageSignature)) {
      stopReason = `pagina ${pageNum} repetiu exatamente os mesmos links`;
      console.log(`[mypcards] ${stopReason} - encerrando paginacao`);
      break;
    }
    if (pageSignature) {
      pageSignatures.add(pageSignature);
    }

    const added = addCards(cards);

    console.log(
      `[mypcards] página ${pageNum}: ${cards.length} cards encontrados, ${added} novos adicionados, total ${uniqueCards.size}`
    );

    if (cards.length === 0) {
      stopReason = `pagina ${pageNum} nao retornou cards validos`;
      console.log(`[mypcards] página ${pageNum} sem cards — encerrando paginação`);
      break;
    }

    if (added === 0) {
      stopReason = `pagina ${pageNum} nao trouxe novos resultados`;
      console.log(`[mypcards] página ${pageNum} sem cards novos — encerrando paginação`);
      break;
    }

    if (pageNum < maxPages) {
      await new Promise((resolve) => setTimeout(resolve, getRequestDelayMs()));
    }
  }

  console.log(`[mypcards] listagem encerrada: ${uniqueCards.size} cards unicos; motivo: ${stopReason}`);
  return Array.from(uniqueCards.values());
}

async function extractDetail(page: Page, detailUrl: string): Promise<MypCardsDetailRaw> {
  return page.evaluate(
    ({ selectors, pageUrl: currentUrl }) => {
      const __name = (value: unknown) => value;

      function absoluteUrl(value: string | null): string | null {
        if (!value) return null;
        try {
          return new URL(value, currentUrl).href;
        } catch {
          return null;
        }
      }

      function cleanText(value: string | null | undefined): string | null {
        const text = value?.replace(/\s+/g, " ").trim() ?? "";
        return text.length > 0 ? text : null;
      }

      function textWithoutChildren(container: Element, selectorsToRemove: string[]): string | null {
        const clone = container.cloneNode(true) as HTMLElement;
        for (const selector of selectorsToRemove) {
          clone.querySelectorAll(selector).forEach((child) => child.remove());
        }
        return cleanText(clone.textContent);
      }

      function fieldByLabel(label: string): string | null {
        const fields = Array.from(document.querySelectorAll<HTMLElement>(".view-field"));
        const wanted = label.toLowerCase();
        for (const field of fields) {
          const fieldLabel = cleanText(field.querySelector("label")?.textContent)?.toLowerCase();
          if (fieldLabel !== wanted) continue;
          return textWithoutChildren(field, ["label"]);
        }
        return null;
      }

      function parseNumberFromName(value: string | null): string | null {
        const match = value?.match(/\(([^)]+)\)/);
        return cleanText(match?.[1]);
      }

      function betterMypImageUrl(value: string | null): string | null {
        if (!value) return null;
        return value
          .replace("https://img.mypcards.com/cdn-cgi/image/h=425,fit=contain,f=auto//", "https://img.mypcards.com/")
          .replace(/_thumb(\.[a-z]+)$/i, "$1");
      }

      function firstText(sels: string[]): string | null {
        for (const sel of sels) {
          const el = document.querySelector<HTMLElement>(sel);
          const text = cleanText(el?.textContent);
          if (text) return text;
        }
        return null;
      }

      function bestImage(sels: string[]): string | null {
        const metaImage = document.querySelector<HTMLMetaElement>("meta[property='og:image'], meta[name='twitter:image']");
        const metaUrl = betterMypImageUrl(metaImage?.getAttribute("content") ?? null);
        if (metaUrl && !/logo|loading|placeholder|forma/i.test(metaUrl)) {
          return absoluteUrl(metaUrl);
        }

        for (const sel of sels) {
          const el = document.querySelector<HTMLImageElement>(sel);
          const src =
            el?.getAttribute("src") ??
            el?.getAttribute("data-src") ??
            el?.getAttribute("data-original");
          const better = betterMypImageUrl(src ?? null);
          if (better && !/logo|loading|placeholder|forma/i.test(better)) {
            return absoluteUrl(better);
          }
        }
        return null;
      }

      const name = firstText(selectors.detailName);
      const setName = fieldByLabel("Edição") ?? firstText(selectors.detailSet);
      const setCode = fieldByLabel("Código");
      const number = firstText(selectors.detailNumber) ?? parseNumberFromName(name);
      const yearText =
        fieldByLabel("Data de lançamento") ??
        firstText(selectors.detailYear) ??
        document.body.textContent?.match(/\b(20\d{2})\b/)?.[0] ??
        null;
      const year = yearText ? Number(yearText.match(/\b(20\d{2})\b/)?.[0] ?? 0) || null : null;
      const rarity = fieldByLabel("Raridade");
      const imageUrl = bestImage(selectors.detailImage);

      const offers: Array<{
        sourceOfferId: string | null;
        priceText: string | null;
        languageText: string | null;
        conditionText: string | null;
        finishText: string | null;
        sellerText: string | null;
        storeText: string | null;
        offerUrl: string | null;
        imageUrl: string | null;
        quantity: number | null;
        raw: Record<string, unknown>;
      }> = [];

      let offerRows: HTMLElement[] = [];
      for (const sel of selectors.offerRows) {
        const rows = Array.from(document.querySelectorAll<HTMLElement>(sel));
        if (rows.length > 0) {
          offerRows = rows;
          break;
        }
      }

      // Try to get column headers to map positions
      let headers: string[] = [];
      const headerRow = document.querySelector<HTMLElement>("table thead tr, table tr:first-child");
      if (headerRow) {
        headers = Array.from(headerRow.querySelectorAll("th, td")).map(
          (th) => cleanText(th.textContent)?.toLowerCase() ?? ""
        );
      }

      function colIndex(keywords: string[]): number {
        for (const kw of keywords) {
          const idx = headers.findIndex((h) => h.includes(kw));
          if (idx >= 0) return idx;
        }
        return -1;
      }

      const priceCol = colIndex(["preco", "price", "valor", "r$"]);
      const condCol = colIndex(["condicao", "qualidade", "condition", "estado"]);
      const langCol = colIndex(["idioma", "language", "lang"]);
      const finishCol = colIndex(["versao", "acabamento", "finish", "variacao", "tipo"]);
      const sellerCol = colIndex(["loja", "vendedor", "seller", "store"]);
      const qtyCol = colIndex(["quantidade", "qty", "estoque", "qtd"]);

      for (const row of offerRows) {
        const cells = Array.from(row.querySelectorAll<HTMLElement>("td, th"));
        if (cells.length === 0) continue;

        // Skip header rows
        if (row.closest("thead") || row.querySelectorAll("th").length === cells.length) continue;

        const mypSellerCell = row.querySelector<HTMLElement>(".estoque-lista-nomevendedor");
        if (mypSellerCell) {
          const priceCell = row.querySelector<HTMLElement>(".estoque-lista-precoestoque");
          const priceClone = priceCell?.cloneNode(true) as HTMLElement | undefined;
          priceClone?.querySelectorAll(".moeda-promocao").forEach((promo) => promo.remove());
          const visiblePriceText = cleanText(priceClone?.textContent);
          const allPriceMatches = cleanText(priceCell?.textContent)?.match(/R\$\s*[\d.]+,\d{2}/g) ?? [];
          const priceText = visiblePriceText ?? allPriceMatches[allPriceMatches.length - 1] ?? null;

          const conditionCell = row.querySelector<HTMLElement>(".estoque-lista-qualidadenome");
          const languageText =
            conditionCell?.querySelector<HTMLElement>(".flag-icon[title]")?.getAttribute("title") ??
            null;
          const conditionText = conditionCell
            ? textWithoutChildren(conditionCell, [".flag-icon", ".foto-icon", "svg", "i"])
            : null;

          const finishText = cleanText(row.querySelector<HTMLElement>(".estoque-lista-nomeenfoil")?.textContent);
          const sellerText =
            cleanText(mypSellerCell.querySelector("a")?.textContent) ??
            textWithoutChildren(mypSellerCell, ["i", "svg"]);
          const qtyRaw = cleanText(row.querySelector<HTMLElement>(".estoque-lista-quantidadeestoque")?.textContent);
          const qty = qtyRaw ? parseInt(qtyRaw.replace(/\D/g, ""), 10) || null : null;
          const sourceOfferId =
            row.getAttribute("data-key") ??
            row.querySelector<HTMLElement>(".addToCart[data-idestoque]")?.getAttribute("data-idestoque") ??
            null;

          if (!priceText) continue;

          offers.push({
            sourceOfferId,
            priceText,
            languageText,
            conditionText,
            finishText,
            sellerText,
            storeText: sellerText,
            offerUrl: sourceOfferId ? `${currentUrl}#offer-${sourceOfferId}` : currentUrl,
            imageUrl,
            quantity: isNaN(qty ?? NaN) ? null : qty,
            raw: {
              rowKey: row.getAttribute("data-key"),
              sourceOfferId,
              sellerText,
              languageText,
              conditionText,
              finishText,
              qtyRaw,
              priceText,
              cells: cells.map((c) => cleanText(c.textContent)),
              rowHtml: row.outerHTML.slice(0, 800)
            }
          });
          continue;
        }

        function cellText(idx: number, fallbackSelectors: string[]): string | null {
          if (idx >= 0 && cells[idx]) return cleanText(cells[idx]!.textContent);
          for (const sel of fallbackSelectors) {
            const el = row.querySelector<HTMLElement>(sel);
            if (el) return cleanText(el.textContent);
          }
          return null;
        }

        const priceText = cellText(priceCol, selectors.offerPrice);
        const conditionText = cellText(condCol, selectors.offerCondition);
        const languageText = cellText(langCol, selectors.offerLanguage);
        const finishText = cellText(finishCol, selectors.offerFinish);
        const sellerText = cellText(sellerCol, selectors.offerSeller);
        const qtyRaw = cellText(qtyCol, selectors.offerQty);
        const qty = qtyRaw ? parseInt(qtyRaw.replace(/\D/g, ""), 10) || null : null;

        // Skip rows with no usable price
        if (!priceText && cells.length < 2) continue;

        // Try to find offer link
        const offerAnchor = row.querySelector<HTMLAnchorElement>("a[href]");
        const offerUrl = offerAnchor ? absoluteUrl(offerAnchor.getAttribute("href")) : currentUrl;

        // Try to find offer ID from row data attributes
        const sourceOfferId =
          row.getAttribute("data-key") ??
          row.getAttribute("data-id") ??
          row.getAttribute("data-oferta-id") ??
          row.getAttribute("data-offer-id") ??
          row.querySelector<HTMLElement>(".addToCart[data-idestoque]")?.getAttribute("data-idestoque") ??
          offerAnchor?.getAttribute("data-id") ??
          null;

        offers.push({
          sourceOfferId,
          priceText,
          languageText,
          conditionText,
          finishText,
          sellerText,
          storeText: sellerText,
          offerUrl: offerUrl ?? currentUrl,
          imageUrl: null,
          quantity: isNaN(qty ?? NaN) ? null : qty,
          raw: {
            cells: cells.map((c) => cleanText(c.textContent)),
            rowHtml: row.outerHTML.slice(0, 400)
          }
        });
      }

      // If no offers found via table rows, try alternative structures (accordion, list)
      if (offers.length === 0) {
        const altItems = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".oferta, .offer-item, .oferta-item, [class*='oferta'], [class*='offer']"
          )
        );
        for (const item of altItems) {
          const priceText = cleanText(item.querySelector(".preco, .price, .valor, [class*='price']")?.textContent);
          const conditionText = cleanText(item.querySelector(".condicao, .condition, .qualidade")?.textContent);
          const languageText = cleanText(item.querySelector(".idioma, .language, .lang")?.textContent);
          const finishText = cleanText(item.querySelector(".versao, .acabamento, .finish")?.textContent);
          const sellerText = cleanText(item.querySelector(".loja, .vendedor, .seller")?.textContent);
          const qtyRaw = cleanText(item.querySelector(".quantidade, .qty, .estoque")?.textContent);
          const qty = qtyRaw ? parseInt(qtyRaw.replace(/\D/g, ""), 10) || null : null;
          const anchor = item.querySelector<HTMLAnchorElement>("a[href]");
          const offerUrl = anchor ? absoluteUrl(anchor.getAttribute("href")) : currentUrl;

          if (!priceText) continue;

          offers.push({
            sourceOfferId: item.getAttribute("data-id") ?? null,
            priceText,
            languageText,
            conditionText,
            finishText,
            sellerText,
            storeText: sellerText,
            offerUrl: offerUrl ?? currentUrl,
            imageUrl: null,
            quantity: isNaN(qty ?? NaN) ? null : qty,
            raw: {
              altItem: true,
              text: cleanText(item.textContent)
            }
          });
        }
      }

      return {
        name,
        setName,
        setCode,
        year,
        number,
        rarity,
        imageUrl,
        offers,
        raw: {
          pageTitle: document.title,
          offerCount: offers.length,
          url: currentUrl
        }
      };
    },
    {
      selectors: {
        detailName: [...mypCardsSelectors.detailName],
        detailImage: [...mypCardsSelectors.detailImage],
        detailSet: [...mypCardsSelectors.detailSet],
        detailNumber: [...mypCardsSelectors.detailNumber],
        detailYear: [...mypCardsSelectors.detailYear],
        offerRows: [...mypCardsSelectors.offerRows],
        offerPrice: [...mypCardsSelectors.offerPrice],
        offerCondition: [...mypCardsSelectors.offerCondition],
        offerLanguage: [...mypCardsSelectors.offerLanguage],
        offerFinish: [...mypCardsSelectors.offerFinish],
        offerSeller: [...mypCardsSelectors.offerSeller],
        offerQty: [...mypCardsSelectors.offerQty]
      },
      pageUrl: detailUrl
    }
  );
}

async function saveFailureScreenshot(page: Page, label: string): Promise<string | null> {
  const dir = path.resolve(process.cwd(), "storage/screenshots");
  mkdirSync(dir, { recursive: true });
  const fileName = `mypcards-${Date.now()}-${slugifyText(label)}.png`;
  const filePath = path.join(dir, fileName);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return null;
  }
}

async function scrapeDetailCard(
  detailPage: Page,
  queuedCard: QueuedMypCard
): Promise<ReturnType<typeof mapMypCardsCard>> {
  const requestDelayMs = getRequestDelayMs();
  const detailUrl = queuedCard.listing.detailUrl!;

  await detailPage.goto(detailUrl, {
    waitUntil: "domcontentloaded",
    timeout: monitorConfig.mypcards.cardTimeoutMs
  });

  await detailPage
    .waitForLoadState("networkidle", {
      timeout: Math.min(8_000, monitorConfig.mypcards.cardTimeoutMs)
    })
    .catch(() => undefined);

  await detailPage.waitForTimeout(Math.min(400, requestDelayMs));
  await ensureEvaluateHelpers(detailPage);

  const detail = await extractDetail(detailPage, detailUrl);
  return mapMypCardsCard(queuedCard.listing, detail);
}

function mapListingFallbackCard(queuedCard: QueuedMypCard): ReturnType<typeof mapMypCardsCard> {
  return mapMypCardsCard(queuedCard.listing, {
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

export async function scrapeMypCards(hooks?: SourceScraperHooks): Promise<SourceScrapeResult> {
  if (!monitorConfig.mypcards.enabled) {
    console.log("[mypcards] fonte desativada por MYP_ENABLED=false");
    return {
      source: "MYPCARDS",
      status: "success",
      cards: [],
      errors: []
    };
  }

  const browser = await chromium.launch({
    headless: env.HEADLESS,
    slowMo: monitorConfig.delays.slowMo
  });
  const errors: string[] = [];

  try {
    await hooks?.onStageChange?.({
      source: "MYPCARDS",
      stage: "LOADING_MYPCARDS_RESULTS",
      message: "Abrindo busca da MYP Cards..."
    });

    console.log("[mypcards] iniciando coleta de listagem");

    const listingCards = await collectAllListingCards(browser, hooks);
    const seenLinks = new Set<string>();
    const dedupedCards = listingCards.filter((card) => {
      if (!card.detailUrl || seenLinks.has(card.detailUrl)) return false;
      seenLinks.add(card.detailUrl);
      return true;
    });

    const enriched = dedupedCards.map((card) => ({
      ...card,
      sourceCardId: card.sourceCardId ?? extractCardIdFromUrl(card.detailUrl)
    }));

    const { newCardsQueue, knownCardsQueue } = splitCardsByKnownState(enriched);
    const queue = [...newCardsQueue, ...knownCardsQueue];
    const totalCards = queue.length;

    console.log(
      `[mypcards] cards novos: ${newCardsQueue.length}, conhecidos: ${knownCardsQueue.length}`
    );
    console.log(
      `[mypcards] processando ${newCardsQueue.length} cards novos primeiro`
    );

    await hooks?.onStageChange?.({
      source: "MYPCARDS",
      stage: "COLLECTING_MYPCARDS_CARDS",
      message: `MYP Cards: ${totalCards} cards na fila.`,
      totalCardsDiscovered: totalCards,
      totalCards
    });

    const results: SourceScrapeResult["cards"] = [];
    let cursor = 0;
    let processedCards = 0;

    const workerCount = totalCards > 0 ? 1 : 0;

    async function worker(workerIndex: number): Promise<void> {
      while (true) {
        const currentIndex = cursor;
        const queuedCard = queue[currentIndex];
        if (!queuedCard) break;
        cursor += 1;

        let detailContext: BrowserContext | null = null;
        let detailPage: Page | null = null;

        const currentName = queuedCard.listing.name ?? "Rayquaza";

        await hooks?.onStageChange?.({
          source: "MYPCARDS",
          stage: "SCRAPING_MYPCARDS_CARD_DETAILS",
          message: `MYP Cards: coletando ${currentName}...`,
          currentCardName: currentName,
          currentCardImageUrl: queuedCard.listing.imageUrl,
          processedCards,
          totalCards
        });

        try {
          detailContext = await createMypBrowserContext(browser);
          detailPage = await detailContext.newPage();
          detailPage.setDefaultTimeout(monitorConfig.mypcards.cardTimeoutMs);
          detailPage.setDefaultNavigationTimeout(monitorConfig.mypcards.cardTimeoutMs);

          const mappedCard = await scrapeDetailCard(detailPage, queuedCard);
          processedCards += 1;
          console.log(
            `[mypcards] worker ${workerIndex} -> ${mappedCard.name} (${mappedCard.offers.length} ofertas)`
          );
          results.push(mappedCard);
          await hooks?.onCardScraped?.(mappedCard, {
            source: "MYPCARDS",
            processedCards,
            totalCards,
            cardIsNew: queuedCard.cardIsNew
          });
        } catch (error) {
          processedCards += 1;
          const fallbackCard = mapListingFallbackCard(queuedCard);
          results.push(fallbackCard);
          await hooks?.onCardScraped?.(fallbackCard, {
            source: "MYPCARDS",
            processedCards,
            totalCards,
            cardIsNew: queuedCard.cardIsNew
          });
          const screenshotPath = detailPage ? await saveFailureScreenshot(detailPage, currentName) : null;
          const message = error instanceof Error ? error.message : "Unknown MYP Cards detail error";
          const errMsg = `[mypcards] falha ${queuedCard.listing.detailUrl}: ${message}${
            screenshotPath ? ` (screenshot: ${screenshotPath})` : ""
          }`;
          errors.push(errMsg);
          console.error(errMsg);
        } finally {
          await detailPage?.close().catch(() => undefined);
          await detailContext?.close().catch(() => undefined);
        }

        await hooks?.onStageChange?.({
          source: "MYPCARDS",
          stage: "SCRAPING_MYPCARDS_CARD_DETAILS",
          message: `MYP Cards: ${processedCards}/${totalCards} cards processados.`,
          processedCards,
          totalCards
        });

        await new Promise((resolve) => setTimeout(resolve, getRequestDelayMs()));
      }
    }

    await Promise.all(Array.from({ length: workerCount }, (_, i) => worker(i + 1)));

    if (results.length === 0) {
      errors.push("[mypcards] nenhum card foi coletado");
    }

    const totalOffers = results.reduce((sum, card) => sum + card.offers.length, 0);
    console.log(`[mypcards] finalizou: ${results.length} cards, ${totalOffers} ofertas`);

    return {
      source: "MYPCARDS",
      status: results.length > 0 ? (errors.length > 0 ? "partial" : "success") : "partial",
      cards: results,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MYP Cards scraper error";
    console.error(`[mypcards] erro fatal: ${message}`);
    return {
      source: "MYPCARDS",
      status: "error",
      cards: [],
      errors: [message]
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
