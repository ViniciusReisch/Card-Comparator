import { DiffService } from "./diff.service";
import { monitorStatusService } from "./monitor-status.service";
import { RunService, type MonitorRunSummary, type SourceRunSummary } from "./run.service";
import { currencyConverter } from "./currency-converter";
import { notificationService } from "./notification.service";
import type { MonitorStatusSnapshot } from "../domain/monitor.types";
import type { SourceKey } from "../domain/source.types";
import { scrapeLigaPokemon } from "../sources/ligapokemon/ligapokemon.scraper";
import { scrapeCardTrader } from "../sources/cardtrader/cardtrader.scraper";
import { scrapeMypCards } from "../sources/mypcards/mypcards.scraper";

let activeMonitorPromise: Promise<MonitorRunSummary> | null = null;

export class MonitorService {
  private readonly diffService = new DiffService();
  private readonly runService = new RunService();
  private pendingRun: { sources?: string[] } | null = null;

  isRunning(): boolean {
    return activeMonitorPromise !== null;
  }

  getStatus(): MonitorStatusSnapshot {
    return monitorStatusService.getStatus();
  }

  startManualMonitor(options?: { sources?: string[] }): MonitorStatusSnapshot {
    if (activeMonitorPromise) {
      this.pendingRun = { sources: options?.sources };
      return this.getStatus();
    }
    return this.startMonitor(options);
  }

  startScheduledMonitor(): MonitorStatusSnapshot {
    return this.startMonitor();
  }

  private startMonitor(options?: { sources?: string[] }): MonitorStatusSnapshot {
    if (activeMonitorPromise) {
      throw new Error("A monitor run is already in progress.");
    }

    this.runService.assertCanRun();
    activeMonitorPromise = this.executeRun(options);
    return this.getStatus();
  }

  async runManualMonitor(): Promise<MonitorRunSummary> {
    this.startManualMonitor();
    return this.waitForCurrentRun();
  }

  async waitForCurrentRun(): Promise<MonitorRunSummary> {
    if (!activeMonitorPromise) {
      throw new Error("No monitor run is currently in progress.");
    }

    return activeMonitorPromise;
  }

  private async executeRun(options?: { sources?: string[] }): Promise<MonitorRunSummary> {
    const run = this.runService.startRun();
    const previousRun = this.runService.getLatestCompletedRun();
    const previousSourceRuns = previousRun ? this.runService.listSourceRuns(previousRun.id) : [];
    const sourceCardEstimates = new Map<SourceKey, number>(
      previousSourceRuns
        .filter((sourceRun): sourceRun is typeof sourceRun & { source: SourceKey } =>
          sourceRun.source === "LIGA_POKEMON" || sourceRun.source === "CARDTRADER" || sourceRun.source === "MYPCARDS"
        )
        .map((sourceRun) => [sourceRun.source, sourceRun.cards_found])
    );

    const initialSnapshot = monitorStatusService.startRun({
      runId: run.id,
      startedAt: run.startedAt,
      totalCardsEstimated: previousRun?.estimated_total_cards ?? previousRun?.total_cards_found ?? null,
      message: "Iniciando monitoramento..."
    });
    this.runService.updateProgress(run.id, initialSnapshot);

    const completedSources: SourceRunSummary[] = [];
    let totalCardsFound = 0;
    let totalProcessedCards = 0;
    let totalOffersFound = 0;
    let newOffersFound = 0;
    let finalStatus: MonitorRunSummary["status"] = "success";
    let errorMessage: string | null = null;

    const allSources = [
      {
        key: "LIGA_POKEMON" as const,
        label: "Liga Pokemon",
        scrape: scrapeLigaPokemon
      },
      {
        key: "CARDTRADER" as const,
        label: "CardTrader",
        scrape: scrapeCardTrader
      },
      {
        key: "MYPCARDS" as const,
        label: "MYP Cards",
        scrape: scrapeMypCards
      }
    ];

    const sources =
      options?.sources && options.sources.length > 0
        ? allSources.filter((s) => options.sources!.includes(s.key))
        : allSources;

    try {
      await currencyConverter.initialize();
      this.diffService.resetNewOfferFlags();

      for (const source of sources) {
        const sourceRun = this.runService.startSource(run.id, source.key);
        const seenOfferIds = new Set<number>();
        let sourceCardsFound = 0;
        let sourceOffersFound = 0;
        let sourceNewOffersFound = 0;
        let sourceProcessedCards = 0;
        let sourceTotalCards = sourceCardEstimates.get(source.key) ?? 0;

        const pushStatus = (input: Partial<MonitorStatusSnapshot>): MonitorStatusSnapshot => {
          const estimates = new Map(sourceCardEstimates);
          if (sourceTotalCards > 0) {
            estimates.set(source.key, sourceTotalCards);
          }

          const estimatedTotalCards = (() => {
            const values = Array.from(estimates.values()).filter((value) => value > 0);
            return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
          })();

          const snapshot = monitorStatusService.update({
            currentSource: source.key,
            totalCardsEstimated: estimatedTotalCards,
            processedCards: totalProcessedCards + sourceProcessedCards,
            totalOffersFound,
            newOffersFound,
            totalSourcesDone: completedSources.length,
            ...input
          });
          this.runService.updateProgress(run.id, snapshot);
          return snapshot;
        };

        try {
          pushStatus({
            message: `Preparando coleta em ${source.label}...`
          });

          const scrapeResult = await source.scrape({
            onStageChange: async (update) => {
              if (typeof update.totalCardsDiscovered === "number" && update.totalCardsDiscovered > 0) {
                sourceTotalCards = update.totalCardsDiscovered;
                sourceCardEstimates.set(source.key, update.totalCardsDiscovered);
              }

              if (typeof update.processedCards === "number") {
                sourceProcessedCards = update.processedCards;
              }

              pushStatus({
                currentStage: update.stage,
                currentCardName: update.currentCardName ?? null,
                currentCardImageUrl: update.currentCardImageUrl ?? null,
                message: update.message ?? monitorStatusService.getStatus().message
              });
            },
            onCardScraped: async (card, meta) => {
              sourceProcessedCards = meta.processedCards;
              const persisted = this.diffService.persistScrapedCard(card, run.id);
              sourceCardsFound += 1;
              sourceOffersFound += persisted.offersFound;
              sourceNewOffersFound += persisted.newOffersFound;
              totalCardsFound += 1;
              totalOffersFound += persisted.offersFound;
              newOffersFound += persisted.newOffersFound;

              for (const seenOfferId of persisted.seenOfferIds) {
                seenOfferIds.add(seenOfferId);
              }

              pushStatus({
                currentStage:
                  source.key === "LIGA_POKEMON"
                    ? "SCRAPING_LIGA_CARD_DETAILS"
                    : source.key === "MYPCARDS"
                      ? "SCRAPING_MYPCARDS_CARD_DETAILS"
                      : "SCRAPING_CARDTRADER_CARD_DETAILS",
                currentCardName: card.name,
                currentCardImageUrl: card.imageUrl,
                message: `Coletando ofertas do card ${card.name}...`
              });

              for (const recentOffer of persisted.newOffers) {
                const snapshot = monitorStatusService.pushRecentNewOffer(recentOffer);
                this.runService.updateProgress(run.id, snapshot);
                await notificationService.notifyNewOffer(recentOffer, run.id);
              }
            }
          });

          if (scrapeResult.status === "success") {
            this.diffService.reconcileSourceSeenOffers(source.key, Array.from(seenOfferIds));
          }

          this.runService.completeSource(sourceRun.id, {
            status: scrapeResult.status,
            cardsFound: sourceCardsFound,
            offersFound: sourceOffersFound,
            newOffersFound: sourceNewOffersFound,
            errorMessage: scrapeResult.errors.length > 0 ? scrapeResult.errors.join(" | ") : null
          });

          completedSources.push({
            id: sourceRun.id,
            source: source.key,
            status: scrapeResult.status,
            cardsFound: sourceCardsFound,
            offersFound: sourceOffersFound,
            newOffersFound: sourceNewOffersFound,
            errorMessage: scrapeResult.errors.length > 0 ? scrapeResult.errors.join(" | ") : null
          });

          if (scrapeResult.status === "partial" && finalStatus === "success") {
            finalStatus = "partial";
          }
          if (scrapeResult.status === "error") {
            finalStatus = "partial";
          }

          pushStatus({
            totalSourcesDone: completedSources.length,
            currentCardName: null,
            currentCardImageUrl: null,
            message: `${source.label} finalizado: ${sourceCardsFound} cards e ${sourceOffersFound} ofertas.`
          });
          totalProcessedCards += sourceProcessedCards;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown monitor source error";

          this.runService.completeSource(sourceRun.id, {
            status: "error",
            cardsFound: sourceCardsFound,
            offersFound: sourceOffersFound,
            newOffersFound: sourceNewOffersFound,
            errorMessage: message
          });

          completedSources.push({
            id: sourceRun.id,
            source: source.key,
            status: "error",
            cardsFound: sourceCardsFound,
            offersFound: sourceOffersFound,
            newOffersFound: sourceNewOffersFound,
            errorMessage: message
          });

          finalStatus = "partial";
          errorMessage = errorMessage ? `${errorMessage} | ${message}` : message;

          pushStatus({
            totalSourcesDone: completedSources.length,
            message: `${source.label} falhou: ${message}`
          });
          totalProcessedCards += sourceProcessedCards;
        }
      }

      const finishedAt = new Date().toISOString();
      const summary = this.runService.completeRun({
        id: run.id,
        startedAt: run.startedAt,
        finishedAt,
        status: totalCardsFound === 0 && totalOffersFound === 0 ? "partial" : finalStatus,
        totalCardsFound,
        totalOffersFound,
        newOffersFound,
        errorMessage,
        sources: completedSources
      });

      const finishedSnapshot = monitorStatusService.finish({
        stage: summary.status === "error" ? "FAILED" : "FINISHED",
        finishedAt,
        message:
          summary.status === "success"
            ? `Monitoramento concluido com ${summary.newOffersFound} novos anuncios.`
            : `Monitoramento finalizado com status ${summary.status}.`,
        progressPercent: summary.status === "success" || summary.status === "partial" ? 100 : null
      });
      this.runService.updateProgress(run.id, finishedSnapshot);

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown monitor error";
      const finishedAt = new Date().toISOString();

      const summary = this.runService.completeRun({
        id: run.id,
        startedAt: run.startedAt,
        finishedAt,
        status: "error",
        totalCardsFound,
        totalOffersFound,
        newOffersFound,
        errorMessage: message,
        sources: completedSources
      });

      const failedSnapshot = monitorStatusService.finish({
        stage: "FAILED",
        finishedAt,
        message: `Monitoramento interrompido: ${message}`
      });
      this.runService.updateProgress(run.id, failedSnapshot);

      return summary;
    } finally {
      activeMonitorPromise = null;
      const pending = this.pendingRun;
      this.pendingRun = null;
      if (pending) {
        console.log("[monitor] iniciando pending run apos conclusao da run atual");
        this.startMonitor(pending);
      }
    }
  }
}

export const monitorService = new MonitorService();
