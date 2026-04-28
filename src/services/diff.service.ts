import { createHash } from "node:crypto";
import { CardRepository } from "../db/repositories/card.repository";
import { OfferRepository } from "../db/repositories/offer.repository";
import type { ScrapedCardResult } from "../domain/card.types";
import type { RecentNewOfferSummary } from "../domain/monitor.types";
import type { SourceKey, SourceScrapeStatus } from "../domain/source.types";
import { extractOfferFinish } from "../normalizers/finish-normalizer";
import { buildCanonicalCardKey, buildCanonicalOfferKey } from "../normalizers/offer-key";
import { currencyConverter } from "./currency-converter";

export type PersistedCardSummary = {
  source: SourceKey;
  cardId: number;
  cardWasInserted: boolean;
  offersFound: number;
  newOffersFound: number;
  seenOfferIds: number[];
  newOffers: RecentNewOfferSummary[];
};

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

  persistScrapedCard(card: ScrapedCardResult, runId: number): PersistedCardSummary {
    const now = new Date().toISOString();
    const canonicalCardKey = buildCanonicalCardKey(card);
    const cardUpserted = this.cardRepository.upsert({
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
      firstSeenAt: now,
      lastSeenAt: now,
      rawHash: hashPayload(card.raw),
      rawJson: JSON.stringify(card.raw)
    });

    const seenOfferIds: number[] = [];
    const newOffers: RecentNewOfferSummary[] = [];
    let offersFound = 0;
    let newOffersFound = 0;

    for (const offer of card.offers) {
      if (offer.source === "LIGA_POKEMON" && (offer.priceCents <= 0 || offer.currency === "UNKNOWN")) {
        continue;
      }

      const canonicalOfferKey = buildCanonicalOfferKey(offer);
      const { priceBrlCents, exchangeRate, exchangeRateDate } = currencyConverter.convertToBrl(
        offer.priceCents,
        offer.currency
      );

      const upserted = this.offerRepository.upsert({
        cardId: cardUpserted.card.id,
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
        finishRaw: offer.finishRaw ?? null,
        finishNormalized: offer.finishNormalized ?? null,
        variantLabel: offer.variantLabel ?? null,
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
        firstSeenRunId: runId,
        firstSeenAt: now,
        lastSeenAt: now,
        rawHash: hashPayload(offer.raw),
        rawJson: JSON.stringify(offer.raw)
      });

      offersFound += 1;
      seenOfferIds.push(upserted.offer.id);

      if (upserted.wasInserted) {
        const finish = extractOfferFinish(upserted.offer.raw_json);
        newOffersFound += 1;
        newOffers.push({
          id: upserted.offer.id,
          cardId: cardUpserted.card.id,
          source: upserted.offer.source as SourceKey,
          cardName: upserted.offer.card_name,
          setName: upserted.offer.set_name,
          setCode: upserted.offer.set_code,
          year: upserted.offer.year,
          number: card.number,
          languageRaw: upserted.offer.language_raw,
          languageNormalized: upserted.offer.language_normalized,
          conditionRaw: upserted.offer.condition_raw,
          conditionNormalized: upserted.offer.condition_normalized,
          finishRaw: upserted.offer.finish_raw ?? finish.finishRaw,
          finishNormalized: upserted.offer.finish_normalized ?? finish.finishNormalized,
          variantLabel: upserted.offer.variant_label ?? finish.variantLabel,
          finishTags: upserted.offer.variant_label ? [upserted.offer.variant_label] : finish.finishTags,
          priceCents: upserted.offer.price_cents,
          currency: upserted.offer.currency,
          priceBrlCents: upserted.offer.price_brl_cents,
          exchangeRateToBrl: upserted.offer.exchange_rate_to_brl,
          exchangeRateDate: upserted.offer.exchange_rate_date,
          imageUrl: upserted.offer.image_url ?? card.imageUrl,
          offerUrl: upserted.offer.offer_url,
          sellerName: upserted.offer.seller_name,
          sellerCountry: upserted.offer.seller_country,
          storeName: upserted.offer.store_name,
          quantity: upserted.offer.quantity,
          isNew: Boolean(upserted.offer.is_new),
          isActive: Boolean(upserted.offer.is_active),
          firstSeenAt: upserted.offer.first_seen_at,
          lastSeenAt: upserted.offer.last_seen_at,
          lastPriceCents: upserted.offer.last_price_cents,
          firstSeenRunId: upserted.offer.first_seen_run_id
        });
      }
    }

    return {
      source: card.source,
      cardId: cardUpserted.card.id,
      cardWasInserted: cardUpserted.wasInserted,
      offersFound,
      newOffersFound,
      seenOfferIds,
      newOffers
    };
  }

  reconcileSourceSeenOffers(source: SourceKey, seenOfferIds: number[]): void {
    this.offerRepository.reconcileMissingOffers(source, seenOfferIds);
  }
}
