import type { SourceKey } from "./source.types";

export const normalizedLanguages = [
  "PORTUGUESE",
  "ENGLISH",
  "JAPANESE",
  "SPANISH",
  "ITALIAN",
  "FRENCH",
  "GERMAN",
  "KOREAN",
  "CHINESE_SIMPLIFIED",
  "CHINESE_TRADITIONAL",
  "THAI",
  "INDONESIAN",
  "RUSSIAN",
  "DUTCH",
  "UNKNOWN"
] as const;

export type NormalizedLanguage = (typeof normalizedLanguages)[number];

export const normalizedConditions = [
  "M",
  "NM",
  "EX",
  "SP",
  "MP",
  "PL",
  "PO",
  "UNKNOWN"
] as const;

export type NormalizedCondition = (typeof normalizedConditions)[number];

export const normalizedFinishes = [
  "NORMAL",
  "FOIL",
  "REVERSE_FOIL",
  "FULL_ART",
  "ALTERED_ART",
  "POKEBALL_FOIL",
  "MASTERBALL_FOIL",
  "PROMO",
  "UNLIMITED",
  "UNLIMITED_FOIL",
  "STAFF",
  "OVERSIZE",
  "UNKNOWN"
] as const;

export type NormalizedFinish = (typeof normalizedFinishes)[number];

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
  finishRaw?: string | null;
  finishNormalized?: NormalizedFinish;
  variantLabel?: string | null;
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
  finishRaw: string | null;
  finishNormalized: NormalizedFinish | "UNKNOWN";
  variantLabel: string | null;
  finishTags: string[];
  priceCents: number;
  currency: string;
  priceBrlCents: number | null;
  exchangeRateToBrl: number | null;
  exchangeRateDate: string | null;
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
