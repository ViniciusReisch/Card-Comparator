import type { SourceKey } from "./source.types";

export const normalizedLanguages = [
  "PORTUGUESE",
  "ENGLISH",
  "JAPANESE",
  "SPANISH",
  "ITALIAN",
  "FRENCH",
  "GERMAN",
  "UNKNOWN"
] as const;

export type NormalizedLanguage = (typeof normalizedLanguages)[number];

export const normalizedConditions = [
  "MINT",
  "NEAR_MINT",
  "EXCELLENT",
  "SLIGHTLY_PLAYED",
  "MODERATELY_PLAYED",
  "PLAYED",
  "HEAVILY_PLAYED",
  "POOR",
  "DAMAGED",
  "UNKNOWN"
] as const;

export type NormalizedCondition = (typeof normalizedConditions)[number];

export type ScrapedOfferSeed = {
  source: SourceKey;
  sourceOfferId: string | null;
  cardName: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  languageRaw: string | null;
  languageNormalized: NormalizedLanguage;
  conditionRaw: string | null;
  conditionNormalized: NormalizedCondition;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  offerUrl: string | null;
  sellerName: string | null;
  sellerCountry: string | null;
  storeName: string | null;
  quantity: number | null;
  raw: Record<string, unknown>;
};

export type OfferListItem = {
  id: number;
  cardId: number;
  source: SourceKey;
  cardName: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  languageRaw: string | null;
  languageNormalized: NormalizedLanguage | "UNKNOWN";
  conditionRaw: string | null;
  conditionNormalized: NormalizedCondition | "UNKNOWN";
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  offerUrl: string | null;
  sellerName: string | null;
  sellerCountry: string | null;
  storeName: string | null;
  quantity: number | null;
  isNew: boolean;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
};

