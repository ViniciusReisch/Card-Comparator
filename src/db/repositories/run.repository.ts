import { getDatabase } from "../database";

export type MonitorRunRecord = {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  total_cards_found: number;
  total_offers_found: number;
  new_offers_found: number;
  error_message: string | null;
  progress_snapshot_json: string | null;
  duration_ms: number | null;
  estimated_total_cards: number | null;
  processed_cards: number;
  total_sources_done: number;
};

export type MonitorRunSourceRecord = {
  id: number;
  run_id: number;
  source: string;
  status: string;
  cards_found: number;
  offers_found: number;
  new_offers_found: number;
  error_message: string | null;
};

export class RunRepository {
  private readonly database = getDatabase();

  createMonitorRun(startedAt: string): number {
    const result = this.database
      .prepare(
        `
          INSERT INTO monitor_runs (
            started_at,
            status,
            total_cards_found,
            total_offers_found,
            new_offers_found,
            processed_cards,
            total_sources_done
          ) VALUES (?, 'running', 0, 0, 0, 0, 0)
        `
      )
      .run(startedAt);

    return Number(result.lastInsertRowid);
  }

  completeMonitorRun(input: {
    runId: number;
    status: string;
    startedAt: string;
    finishedAt: string;
    totalCardsFound: number;
    totalOffersFound: number;
    newOffersFound: number;
    errorMessage?: string | null;
  }): void {
    this.database
      .prepare(
        `
          UPDATE monitor_runs
          SET
            finished_at = @finishedAt,
            status = @status,
            total_cards_found = @totalCardsFound,
            total_offers_found = @totalOffersFound,
            new_offers_found = @newOffersFound,
            error_message = @errorMessage,
            duration_ms = @durationMs
          WHERE id = @runId
        `
      )
      .run({
        ...input,
        durationMs: Math.max(0, new Date(input.finishedAt).getTime() - new Date(input.startedAt).getTime())
      });
  }

  updateMonitorRunProgress(input: {
    runId: number;
    progressSnapshotJson: string;
    estimatedTotalCards: number | null;
    processedCards: number;
    totalSourcesDone: number;
  }): void {
    this.database
      .prepare(
        `
          UPDATE monitor_runs
          SET
            progress_snapshot_json = @progressSnapshotJson,
            estimated_total_cards = @estimatedTotalCards,
            processed_cards = @processedCards,
            total_sources_done = @totalSourcesDone
          WHERE id = @runId
        `
      )
      .run(input);
  }

  createSourceRun(runId: number, source: string): number {
    const result = this.database
      .prepare(
        `
          INSERT INTO monitor_run_sources (
            run_id,
            source,
            status,
            cards_found,
            offers_found,
            new_offers_found
          ) VALUES (?, ?, 'running', 0, 0, 0)
        `
      )
      .run(runId, source);

    return Number(result.lastInsertRowid);
  }

  completeSourceRun(input: {
    sourceRunId: number;
    status: string;
    cardsFound: number;
    offersFound: number;
    newOffersFound: number;
    errorMessage?: string | null;
  }): void {
    this.database
      .prepare(
        `
          UPDATE monitor_run_sources
          SET
            status = @status,
            cards_found = @cardsFound,
            offers_found = @offersFound,
            new_offers_found = @newOffersFound,
            error_message = @errorMessage
          WHERE id = @sourceRunId
        `
      )
      .run(input);
  }

  getLatestRun(): MonitorRunRecord | undefined {
    return this.database
      .prepare("SELECT * FROM monitor_runs ORDER BY started_at DESC LIMIT 1")
      .get() as MonitorRunRecord | undefined;
  }

  getLatestCompletedRun(): MonitorRunRecord | undefined {
    return this.database
      .prepare("SELECT * FROM monitor_runs WHERE status != 'running' ORDER BY started_at DESC LIMIT 1")
      .get() as MonitorRunRecord | undefined;
  }

  listRuns(limit = 50): MonitorRunRecord[] {
    return this.database
      .prepare("SELECT * FROM monitor_runs ORDER BY started_at DESC LIMIT ?")
      .all(limit) as MonitorRunRecord[];
  }

  listSourceRuns(runId: number): MonitorRunSourceRecord[] {
    return this.database
      .prepare(
        "SELECT * FROM monitor_run_sources WHERE run_id = ? ORDER BY source ASC"
      )
      .all(runId) as MonitorRunSourceRecord[];
  }

  isAnyRunRunning(): boolean {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM monitor_runs WHERE status = 'running'")
      .get() as { count: number };

    return row.count > 0;
  }

  recoverStaleRuns(reason: string): void {
    const finishedAt = new Date().toISOString();

    this.database
      .prepare(
        `
          UPDATE monitor_runs
          SET
            status = 'error',
            finished_at = @finishedAt,
            error_message = COALESCE(error_message, @reason),
            duration_ms = CASE
              WHEN started_at IS NOT NULL
                THEN MAX(0, CAST((julianday(@finishedAt) - julianday(started_at)) * 86400000 AS INTEGER))
              ELSE duration_ms
            END
          WHERE status = 'running'
        `
      )
      .run({ finishedAt, reason });

    this.database
      .prepare(
        `
          UPDATE monitor_run_sources
          SET
            status = 'error',
            error_message = COALESCE(error_message, @reason)
          WHERE status = 'running'
        `
      )
      .run({ reason });
  }
}
