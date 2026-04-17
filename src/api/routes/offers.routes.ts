import { Router } from "express";
import { OfferRepository } from "../../db/repositories/offer.repository";
import { buildOfferFilters, mapOffer } from "./route-helpers";

export function createOffersRouter(): Router {
  const router = Router();
  const offerRepository = new OfferRepository();

  router.get("/offers/new", (req, res) => {
    const query = req.query as Record<string, unknown>;
    const result = offerRepository.listOffers(buildOfferFilters(query, { onlyNew: true, onlyActive: false }));

    res.json({
      items: result.items.map(mapOffer),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  });

  router.get("/offers", (req, res) => {
    const query = req.query as Record<string, unknown>;
    const result = offerRepository.listOffers(buildOfferFilters(query));

    res.json({
      items: result.items.map(mapOffer),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  });

  return router;
}

