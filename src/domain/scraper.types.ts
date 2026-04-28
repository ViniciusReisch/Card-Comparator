import type { ScrapedCardResult } from "./card.types";
import type { MonitorStage } from "./monitor.types";
import type { SourceKey } from "./source.types";

export type ScraperStageUpdate = {
  source: SourceKey;
  stage: MonitorStage;
  message?: string;
  currentCardName?: string | null;
  currentCardImageUrl?: string | null;
  totalCardsDiscovered?: number;
  processedCards?: number;
  totalCards?: number;
};

export type ScrapedCardMeta = {
  source: SourceKey;
  processedCards: number;
  totalCards: number;
  cardIsNew: boolean;
};

export type SourceScraperHooks = {
  onStageChange?: (update: ScraperStageUpdate) => Promise<void> | void;
  onCardScraped?: (card: ScrapedCardResult, meta: ScrapedCardMeta) => Promise<void> | void;
};
