import { RunRepository } from "../db/repositories/run.repository";
import type { MonitorStatusSnapshot } from "../domain/monitor.types";
import type { SourceKey, MonitorStatus, SourceScrapeStatus } from "../domain/source.types";

export type SourceRunSummary = {
  id: number;
  source: SourceKey;
  status: SourceScrapeStatus;
  cardsFound: number;
  offersFound: number;
  newOffersFound: number;
  errorMessage: string | null;
};

export type MonitorRunSummary = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: MonitorStatus;
  totalCardsFound: number;
  totalOffersFound: number;
  newOffersFound: number;
  errorMessage: string | null;
  sources: SourceRunSummary[];
};

export class RunService {
  private readonly repository = new RunRepository();

  assertCanRun(): void {
    if (this.repository.isAnyRunRunning()) {
      this.repository.recoverStaleRuns("Recovered stale running monitor after process restart.");
    }
  }

  startRun(): MonitorRunSummary {
    const startedAt = new Date().toISOString();
    const runId = this.repository.createMonitorRun(startedAt);

    return {
      id: runId,
      startedAt,
      finishedAt: null,
      status: "running",
      totalCardsFound: 0,
      totalOffersFound: 0,
      newOffersFound: 0,
      errorMessage: null,
      sources: []
    };
  }

  startSource(runId: number, source: SourceKey): SourceRunSummary {
    const sourceRunId = this.repository.createSourceRun(runId, source);

    return {
      id: sourceRunId,
      source,
      status: "success",
      cardsFound: 0,
      offersFound: 0,
      newOffersFound: 0,
      errorMessage: null
    };
  }

  completeSource(
    sourceRunId: number,
    input: Omit<SourceRunSummary, "id" | "source">
  ): void {
    this.repository.completeSourceRun({
      sourceRunId,
      status: input.status,
      cardsFound: input.cardsFound,
      offersFound: input.offersFound,
      newOffersFound: input.newOffersFound,
      errorMessage: input.errorMessage
    });
  }

  completeRun(input: Omit<MonitorRunSummary, "startedAt" | "sources"> & { startedAt: string; sources: SourceRunSummary[] }): MonitorRunSummary {
    this.repository.completeMonitorRun({
      runId: input.id,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt ?? new Date().toISOString(),
      totalCardsFound: input.totalCardsFound,
      totalOffersFound: input.totalOffersFound,
      newOffersFound: input.newOffersFound,
      errorMessage: input.errorMessage
    });

    return input;
  }

  updateProgress(runId: number, snapshot: MonitorStatusSnapshot): void {
    this.repository.updateMonitorRunProgress({
      runId,
      progressSnapshotJson: JSON.stringify(snapshot),
      estimatedTotalCards: snapshot.totalCardsEstimated,
      processedCards: snapshot.processedCards,
      totalSourcesDone: snapshot.totalSourcesDone
    });
  }

  getLatestCompletedRun() {
    return this.repository.getLatestCompletedRun();
  }

  listSourceRuns(runId: number) {
    return this.repository.listSourceRuns(runId);
  }
}
