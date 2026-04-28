import type { ScrapedCardResult, ScrapedCardSeed } from "../../domain/card.types";
import type { ScrapedOfferSeed } from "../../domain/offer.types";
import { buildCanonicalCardKey, buildCanonicalOfferKey } from "../../normalizers/offer-key";
import { normalizeCondition } from "../../normalizers/condition-normalizer";
import { normalizeFinish } from "../../normalizers/finish-normalizer";
import { normalizeLanguage } from "../../normalizers/language-normalizer";
import { normalizePrice } from "../../normalizers/price-normalizer";
import {
  safeTrim,
  sanitizeImageUrl,
  sanitizeScrapedLabel
} from "../../normalizers/text-normalizer";

export type MypCardsListingRaw = {
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
};

export type MypCardsOfferRaw = {
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
};

export type MypCardsDetailRaw = {
  name: string | null;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  offers: MypCardsOfferRaw[];
  raw: Record<string, unknown>;
};

function parseYear(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = safeTrim(typeof value === "string" ? value : null);
  if (!text) return null;

  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseQuantity(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = safeTrim(typeof value === "string" ? value : null);
  if (!text) return null;

  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function fallbackName(listing: MypCardsListingRaw, detail: MypCardsDetailRaw): string {
  return (
    sanitizeScrapedLabel(detail.name, 120) ??
    sanitizeScrapedLabel(listing.name, 120) ??
    "Rayquaza"
  );
}

export function mapMypCardsCard(
  listing: MypCardsListingRaw,
  detail: MypCardsDetailRaw
): ScrapedCardResult {
  const card: ScrapedCardSeed = {
    source: "MYPCARDS",
    sourceCardId: listing.sourceCardId ?? null,
    name: fallbackName(listing, detail),
    setName: sanitizeScrapedLabel(detail.setName, 140) ?? sanitizeScrapedLabel(listing.setName, 140),
    setCode: safeTrim(listing.setCode) ?? safeTrim(detail.setCode),
    year: parseYear(detail.year) ?? parseYear(listing.year),
    number: safeTrim(detail.number) ?? safeTrim(listing.number),
    rarity: sanitizeScrapedLabel(detail.rarity, 80) ?? sanitizeScrapedLabel(listing.rarity, 80),
    imageUrl: sanitizeImageUrl(detail.imageUrl) ?? sanitizeImageUrl(listing.imageUrl),
    detailUrl: safeTrim(listing.detailUrl),
    raw: {
      listing: listing.raw,
      detail: detail.raw
    }
  };

  const canonicalCardKey = buildCanonicalCardKey(card);
  const offers = detail.offers.map((offer) => mapMypCardsOffer(card, offer));

  return {
    ...card,
    sourceCardId: card.sourceCardId ?? canonicalCardKey,
    offers
  };
}

export function mapMypCardsOffer(card: ScrapedCardSeed, offer: MypCardsOfferRaw): ScrapedOfferSeed {
  const { priceCents, currency } = normalizePrice(offer.priceText);
  const { languageRaw, languageNormalized } = normalizeLanguage(offer.languageText);
  const { conditionRaw, conditionNormalized } = normalizeCondition("MYPCARDS", offer.conditionText);
  const { finishRaw, finishNormalized, variantLabel } = normalizeFinish(offer.finishText, { defaultNormal: true });

  const mapped: ScrapedOfferSeed = {
    source: "MYPCARDS",
    sourceOfferId: safeTrim(offer.sourceOfferId),
    cardName: card.name,
    setName: card.setName,
    setCode: card.setCode,
    year: card.year,
    languageRaw,
    languageNormalized,
    conditionRaw,
    conditionNormalized,
    finishRaw,
    finishNormalized,
    variantLabel,
    priceCents,
    currency,
    imageUrl: sanitizeImageUrl(offer.imageUrl) ?? card.imageUrl,
    offerUrl: safeTrim(offer.offerUrl) ?? card.detailUrl,
    sellerName: sanitizeScrapedLabel(offer.sellerText, 120),
    sellerCountry: null,
    storeName:
      sanitizeScrapedLabel(offer.storeText, 120) ??
      sanitizeScrapedLabel(offer.sellerText, 120),
    quantity: parseQuantity(offer.quantity),
    raw: {
      ...offer.raw,
      finishText: offer.finishText,
      finishRaw,
      finishNormalized,
      variantLabel
    }
  };

  return {
    ...mapped,
    sourceOfferId: mapped.sourceOfferId ?? buildCanonicalOfferKey(mapped)
  };
}
