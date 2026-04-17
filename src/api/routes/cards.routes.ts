import { Router } from "express";
import { CardRepository } from "../../db/repositories/card.repository";
import { OfferRepository } from "../../db/repositories/offer.repository";
import {
  buildOfferFilters,
  mapGroupedCard,
  mapOffer,
  readLimit,
  readNumberQuery,
  readPage,
  readStringQuery
} from "./route-helpers";

export function createCardsRouter(): Router {
  const router = Router();
  const cardRepository = new CardRepository();
  const offerRepository = new OfferRepository();

  router.get("/cards", (req, res) => {
    const query = req.query as Record<string, unknown>;
    const result = cardRepository.listGrouped({
      source: readStringQuery(query, "source"),
      collection: readStringQuery(query, "collection"),
      year: readNumberQuery(query, "year"),
      query: readStringQuery(query, "query"),
      page: readPage(query),
      limit: readLimit(query, 24, 100)
    });

    res.json({
      items: result.items.map(mapGroupedCard),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  });

  router.get("/cards/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid card id." });
      return;
    }

    const card = cardRepository.getGroupedCardById(id);
    if (!card) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    const offers = offerRepository.listOffers({
      ...buildOfferFilters({}, {
        cardGroup: {
          name: card.name,
          setName: card.set_name,
          year: card.year,
          number: card.number
        },
        onlyActive: false,
        page: 1,
        limit: 500
      })
    });

    res.json({
      ...mapGroupedCard(card),
      offersCount: offers.total,
      latestOffers: offers.items.slice(0, 5).map(mapOffer)
    });
  });

  router.get("/cards/:id/offers", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid card id." });
      return;
    }

    const card = cardRepository.getGroupedCardById(id);
    if (!card) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    const query = req.query as Record<string, unknown>;
    const result = offerRepository.listOffers({
      ...buildOfferFilters(query, {
        onlyActive: false,
        cardGroup: {
          name: card.name,
          setName: card.set_name,
          year: card.year,
          number: card.number
        }
      })
    });

    res.json({
      card: mapGroupedCard(card),
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

