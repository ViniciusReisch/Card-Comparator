import { Router } from "express";
import { CardRepository } from "../../db/repositories/card.repository";
import { OfferRepository } from "../../db/repositories/offer.repository";
import { RunRepository } from "../../db/repositories/run.repository";
import { mapOffer, mapRun } from "./route-helpers";

export function createDashboardRouter(): Router {
  const router = Router();
  const cardRepository = new CardRepository();
  const offerRepository = new OfferRepository();
  const runRepository = new RunRepository();

  router.get("/dashboard", (_req, res) => {
    const latestRun = runRepository.getLatestRun();
    const lowestPriceOffer = offerRepository.getLowestActiveOffer();
    const recentNewOffers = offerRepository.listLatestNewOffers(12);
    const languageDistribution = offerRepository.getLanguageDistribution();
    const conditionDistribution = offerRepository.getConditionDistribution();

    res.json({
      stats: {
        totalRayquazasMonitored: cardRepository.countGroupedCards(),
        totalActiveOffers: offerRepository.countActiveOffers(),
        newOffersLastRun: latestRun?.new_offers_found ?? offerRepository.countNewOffers(),
        lowestPrice: lowestPriceOffer
          ? {
              priceCents: lowestPriceOffer.price_cents,
              currency: lowestPriceOffer.currency,
              priceBrlCents: lowestPriceOffer.price_brl_cents,
              cardName: lowestPriceOffer.card_name,
              source: lowestPriceOffer.source,
              offerUrl: lowestPriceOffer.offer_url
            }
          : null,
        latestRun: latestRun ? mapRun(latestRun) : null
      },
      recentNewOffers: recentNewOffers.map(mapOffer),
      distributions: {
        language: languageDistribution,
        condition: conditionDistribution
      }
    });
  });

  return router;
}
