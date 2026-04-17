import { createHash } from "node:crypto";
import { CardRepository } from "../db/repositories/card.repository";
import { OfferRepository } from "../db/repositories/offer.repository";
import type { SourceScrapeResult } from "../domain/card.types";
import type { SourceKey, SourceScrapeStatus } from "../domain/source.types";
import { buildCanonicalCardKey, buildCanonicalOfferKey } from "../normalizers/offer-key";
import { currencyConverter } from "./currency-converter";

export type PersistedSourceSummary = {
  source: SourceKey;
  status: SourceScrapeStatus;
  cardsFound: number;
  offersFound: number;
  newOffersFound: number;
  errors: string[];
};

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class DiffService {
  private readonly cardRepository = new CardRepository();
  private readonly offerRepository = new OfferRepository();

  resetNewOfferFlags(): void {
    this.offerRepository.resetNewFlags();
  }

  persistSourceResult(result: SourceScrapeResult): PersistedSourceSummary {
    const seenOfferIds = new Set<number>();
    let offersFound = 0;
    let newOffersFound = 0;
    const langCounts: Record<string, number> = {};

    for (const card of result.cards) {
      const canonicalCardKey = buildCanonicalCardKey(card);
      const cardRecord = this.cardRepository.upsert({
        source: card.source,
        sourceCardId: card.sourceCardId ?? canonicalCardKey,
        canonicalCardKey,
        name: card.name,
        setName: card.setName,
        setCode: card.setCode,
        year: card.year,
        number: card.number,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        detailUrl: card.detailUrl,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        rawHash: hashPayload(card.raw),
        rawJson: JSON.stringify(card.raw)
      });

      for (const offer of card.offers) {
        const canonicalOfferKey = buildCanonicalOfferKey(offer);
        const { priceBrlCents, exchangeRate, exchangeRateDate } = currencyConverter.convertToBrl(
          offer.priceCents,
          offer.currency
        );

        const lang = offer.languageNormalized ?? "UNKNOWN";
        langCounts[lang] = (langCounts[lang] ?? 0) + 1;

        const upserted = this.offerRepository.upsert({
          cardId: cardRecord.id,
          source: offer.source,
          sourceOfferId: offer.sourceOfferId ?? canonicalOfferKey,
          canonicalOfferKey,
          cardName: offer.cardName,
          setName: offer.setName,
          setCode: offer.setCode,
          year: offer.year,
          languageRaw: offer.languageRaw,
          languageNormalized: offer.languageNormalized,
          conditionRaw: offer.conditionRaw,
          conditionNormalized: offer.conditionNormalized,
          priceCents: offer.priceCents,
          currency: offer.currency,
          originalPriceCents: offer.priceCents,
          originalCurrency: offer.currency,
          priceBrlCents,
          exchangeRateToBrl: exchangeRate,
          exchangeRateDate,
          imageUrl: offer.imageUrl,
          offerUrl: offer.offerUrl,
          sellerName: offer.sellerName,
          sellerCountry: offer.sellerCountry,
          storeName: offer.storeName,
          quantity: offer.quantity,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          rawHash: hashPayload(offer.raw),
          rawJson: JSON.stringify(offer.raw)
        });

        offersFound += 1;
        if (upserted.wasInserted) {
          newOffersFound += 1;
        }

        seenOfferIds.add(upserted.offer.id);
      }
    }

    if (result.status === "success") {
      this.offerRepository.reconcileMissingOffers(result.source, Array.from(seenOfferIds));
    }

    const langLog = Object.entries(langCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([l, c]) => `${l}:${c}`)
      .join(" | ");
    if (langLog) {
      console.log(`[${result.source.toLowerCase()}] idiomas coletados: ${langLog}`);
    }

    return {
      source: result.source,
      status: result.status,
      cardsFound: result.cards.length,
      offersFound,
      newOffersFound,
      errors: result.errors
    };
  }
}
