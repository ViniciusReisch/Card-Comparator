import type { SourceKey, SourceScrapeStatus } from "./source.types";
import type { ScrapedOfferSeed } from "./offer.types";

export type ScrapedCardSeed = {
  source: SourceKey;
  sourceCardId: string | null;
  name: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  detailUrl: string | null;
  raw: Record<string, unknown>;
};

export type ScrapedCardResult = ScrapedCardSeed & {
  offers: ScrapedOfferSeed[];
};

export type SourceScrapeResult = {
  source: SourceKey;
  status: SourceScrapeStatus;
  cards: ScrapedCardResult[];
  errors: string[];
};

export type CardListItem = {
  id: number;
  name: string;
  setName: string | null;
  year: number | null;
  number: string | null;
  imageUrl: string | null;
  sources: SourceKey[];
  activeOfferCount: number;
  minPriceCents: number | null;
  currency: string | null;
};

export type CardDetailSummary = {
  id: number;
  name: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  sources: SourceKey[];
};

