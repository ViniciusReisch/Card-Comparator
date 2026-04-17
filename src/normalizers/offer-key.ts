import type { ScrapedCardSeed } from "../domain/card.types";
import type { ScrapedOfferSeed } from "../domain/offer.types";
import { slugifyText } from "./text-normalizer";

export function buildCanonicalCardKey(card: ScrapedCardSeed): string {
  return [
    slugifyText(card.source),
    slugifyText(card.name),
    slugifyText(card.setName),
    card.year ?? "unknown-year",
    slugifyText(card.number)
  ].join(":");
}

export function buildCanonicalOfferKey(offer: ScrapedOfferSeed): string {
  const sellerIdentity = offer.storeName ?? offer.sellerName ?? "unknown-seller";
  const stableIdentity = offer.sourceOfferId ?? offer.offerUrl ?? `${sellerIdentity}:${offer.quantity ?? "na"}`;

  return [
    slugifyText(offer.source),
    slugifyText(offer.cardName),
    slugifyText(offer.setName),
    offer.year ?? "unknown-year",
    slugifyText(offer.languageNormalized),
    slugifyText(offer.conditionNormalized),
    slugifyText(sellerIdentity),
    slugifyText(stableIdentity)
  ].join(":");
}

