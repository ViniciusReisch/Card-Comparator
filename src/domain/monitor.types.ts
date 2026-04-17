import type { SourceKey } from "./source.types";

export const monitorStages = [
  "IDLE",
  "STARTING",
  "LOADING_LIGA_RESULTS",
  "EXPANDING_LIGA_LOAD_MORE",
  "COLLECTING_LIGA_CARDS",
  "SCRAPING_LIGA_CARD_DETAILS",
  "LOADING_CARDTRADER_RESULTS",
  "PAGINATING_CARDTRADER",
  "COLLECTING_CARDTRADER_CARDS",
  "SCRAPING_CARDTRADER_CARD_DETAILS",
  "SAVING_RESULTS",
  "FINISHED",
  "FAILED"
] as const;

export type MonitorStage = (typeof monitorStages)[number];

export type RecentNewOfferSummary = {
  id: number;
  cardId: number;
  source: SourceKey;
  cardName: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  languageRaw: string | null;
  languageNormalized: string | null;
  conditionRaw: string | null;
  conditionNormalized: string | null;
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
  lastPriceCents: number | null;
  firstSeenRunId: number | null;
};

export type MonitorStatusSnapshot = {
  currentRunId: number | null;
  runId: number | null;
  isRunning: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  currentSource: SourceKey | null;
  currentStage: MonitorStage;
  totalCardsEstimated: number | null;
  processedCards: number;
  totalOffersFound: number;
  newOffersFound: number;
  currentCardName: string | null;
  currentCardImageUrl: string | null;
  progressPercent: number | null;
  message: string;
  recentNewOffers: RecentNewOfferSummary[];
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  totalSourcesDone: number;
  lastUpdatedAt: string | null;
};

export type MonitorEventPayload =
  | {
      type: "status";
      status: MonitorStatusSnapshot;
    }
  | {
      type: "new-offer";
      status: MonitorStatusSnapshot;
      offer: RecentNewOfferSummary;
    };
