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
            new_offers_found
          ) VALUES (?, 'running', 0, 0, 0)
        `
      )
      .run(startedAt);

    return Number(result.lastInsertRowid);
  }

  completeMonitorRun(input: {
    runId: number;
    status: string;
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
            error_message = @errorMessage
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

  isAnyRunRunning(): boolean {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM monitor_runs WHERE status = 'running'")
      .get() as { count: number };

    return row.count > 0;
  }
}

