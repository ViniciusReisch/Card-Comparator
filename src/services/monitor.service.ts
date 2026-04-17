import { DiffService } from "./diff.service";
import { RunService, type MonitorRunSummary, type SourceRunSummary } from "./run.service";
import { scrapeLigaPokemon } from "../sources/ligapokemon/ligapokemon.scraper";
import { scrapeCardTrader } from "../sources/cardtrader/cardtrader.scraper";

let activeMonitorPromise: Promise<MonitorRunSummary> | null = null;

export class MonitorService {
  private readonly diffService = new DiffService();
  private readonly runService = new RunService();

  isRunning(): boolean {
    return activeMonitorPromise !== null;
  }

  async runManualMonitor(): Promise<MonitorRunSummary> {
    if (activeMonitorPromise) {
      throw new Error("A monitor run is already in progress.");
    }

    this.runService.assertCanRun();

    activeMonitorPromise = this.executeRun();

    try {
      return await activeMonitorPromise;
    } finally {
      activeMonitorPromise = null;
    }
  }

  private async executeRun(): Promise<MonitorRunSummary> {
    const run = this.runService.startRun();
    this.diffService.resetNewOfferFlags();

    const completedSources: SourceRunSummary[] = [];
    let totalCardsFound = 0;
    let totalOffersFound = 0;
    let newOffersFound = 0;
    let finalStatus: MonitorRunSummary["status"] = "success";
    let errorMessage: string | null = null;

    for (const source of [
      { key: "LIGA_POKEMON" as const, scrape: scrapeLigaPokemon },
      { key: "CARDTRADER" as const, scrape: scrapeCardTrader }
    ]) {
      const sourceRun = this.runService.startSource(run.id, source.key);

      try {
        const scrapeResult = await source.scrape();
        const persisted = this.diffService.persistSourceResult(scrapeResult);
        const sourceStatus = persisted.status;
        const sourceErrorMessage = persisted.errors.length > 0 ? persisted.errors.join(" | ") : null;

        completedSources.push({
          id: sourceRun.id,
          source: source.key,
          ...this.runService.completeSource(sourceRun.id, {
            status: sourceStatus,
            cardsFound: persisted.cardsFound,
            offersFound: persisted.offersFound,
            newOffersFound: persisted.newOffersFound,
            errorMessage: sourceErrorMessage
          })
        });

        totalCardsFound += persisted.cardsFound;
        totalOffersFound += persisted.offersFound;
        newOffersFound += persisted.newOffersFound;

        if (sourceStatus === "partial" && finalStatus === "success") {
          finalStatus = "partial";
        }

        if (sourceStatus === "error") {
          finalStatus = "partial";
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown monitor source error";
        completedSources.push({
          id: sourceRun.id,
          source: source.key,
          ...this.runService.completeSource(sourceRun.id, {
            status: "error",
            cardsFound: 0,
            offersFound: 0,
            newOffersFound: 0,
            errorMessage: message
          })
        });

        finalStatus = "partial";
        errorMessage = errorMessage ? `${errorMessage} | ${message}` : message;
      }
    }

    return this.runService.completeRun({
      id: run.id,
      startedAt: run.startedAt,
      finishedAt: new Date().toISOString(),
      status: totalCardsFound === 0 && totalOffersFound === 0 ? "partial" : finalStatus,
      totalCardsFound,
      totalOffersFound,
      newOffersFound,
      errorMessage,
      sources: completedSources
    });
  }
}

export const monitorService = new MonitorService();

