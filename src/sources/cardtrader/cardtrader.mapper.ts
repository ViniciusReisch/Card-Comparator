import type { ScrapedCardResult, ScrapedCardSeed } from "../../domain/card.types";
import type { ScrapedOfferSeed } from "../../domain/offer.types";
import { buildCanonicalCardKey, buildCanonicalOfferKey } from "../../normalizers/offer-key";
import { normalizeCondition } from "../../normalizers/condition-normalizer";
import { normalizeLanguage } from "../../normalizers/language-normalizer";
import { normalizePrice } from "../../normalizers/price-normalizer";
import { safeTrim } from "../../normalizers/text-normalizer";

export type CardTraderListingRaw = {
  sourceCardId: string | null;
  name: string | null;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  detailUrl: string | null;
  raw: Record<string, unknown>;
};

export type CardTraderOfferRaw = {
  sourceOfferId: string | null;
  priceText: string | null;
  languageText: string | null;
  conditionText: string | null;
  sellerText: string | null;
  sellerCountry: string | null;
  storeText: string | null;
  offerUrl: string | null;
  imageUrl: string | null;
  quantity: number | null;
  raw: Record<string, unknown>;
};

export type CardTraderDetailRaw = {
  name: string | null;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  offers: CardTraderOfferRaw[];
  raw: Record<string, unknown>;
};

function parseYear(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = safeTrim(typeof value === "string" ? value : null);
  const match = text?.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseQuantity(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = safeTrim(typeof value === "string" ? value : null);
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function mapCardTraderCard(
  listing: CardTraderListingRaw,
  detail: CardTraderDetailRaw
): ScrapedCardResult {
  const card: ScrapedCardSeed = {
    source: "CARDTRADER",
    sourceCardId: listing.sourceCardId,
    name: safeTrim(detail.name) ?? safeTrim(listing.name) ?? "Rayquaza",
    setName: safeTrim(detail.setName) ?? safeTrim(listing.setName),
    setCode: safeTrim(detail.setCode) ?? safeTrim(listing.setCode),
    year: parseYear(detail.year) ?? parseYear(listing.year),
    number: safeTrim(detail.number) ?? safeTrim(listing.number),
    rarity: safeTrim(detail.rarity) ?? safeTrim(listing.rarity),
    imageUrl: safeTrim(detail.imageUrl) ?? safeTrim(listing.imageUrl),
    detailUrl: safeTrim(listing.detailUrl),
    raw: {
      listing: listing.raw,
      detail: detail.raw
    }
  };

  const canonicalCardKey = buildCanonicalCardKey(card);
  const offers = detail.offers.map((offer) => mapCardTraderOffer(card, offer));

  return {
    ...card,
    sourceCardId: card.sourceCardId ?? canonicalCardKey,
    offers
  };
}

export function mapCardTraderOffer(card: ScrapedCardSeed, offer: CardTraderOfferRaw): ScrapedOfferSeed {
  const { priceCents, currency } = normalizePrice(offer.priceText);
  const { languageRaw, languageNormalized } = normalizeLanguage(offer.languageText);
  const { conditionRaw, conditionNormalized } = normalizeCondition("CARDTRADER", offer.conditionText);

  const mapped: ScrapedOfferSeed = {
    source: "CARDTRADER",
    sourceOfferId: safeTrim(offer.sourceOfferId),
    cardName: card.name,
    setName: card.setName,
    setCode: card.setCode,
    year: card.year,
    languageRaw,
    languageNormalized,
    conditionRaw,
    conditionNormalized,
    priceCents,
    currency,
    imageUrl: safeTrim(offer.imageUrl) ?? card.imageUrl,
    offerUrl: safeTrim(offer.offerUrl) ?? card.detailUrl,
    sellerName: safeTrim(offer.sellerText),
    sellerCountry: safeTrim(offer.sellerCountry),
    storeName: safeTrim(offer.storeText) ?? safeTrim(offer.sellerText),
    quantity: parseQuantity(offer.quantity),
    raw: offer.raw
  };

  return {
    ...mapped,
    sourceOfferId: mapped.sourceOfferId ?? buildCanonicalOfferKey(mapped)
  };
}

