import type { Response } from "express";
import {
  type MonitorEventPayload,
  type MonitorStage,
  type MonitorStatusSnapshot,
  type RecentNewOfferSummary
} from "../domain/monitor.types";
import type { SourceKey } from "../domain/source.types";

type MonitorStatusState = Omit<MonitorStatusSnapshot, "elapsedMs" | "estimatedRemainingMs" | "progressPercent"> & {
  progressPercent: number | null;
};

function createIdleState(): MonitorStatusState {
  return {
    currentRunId: null,
    runId: null,
    isRunning: false,
    startedAt: null,
    finishedAt: null,
    currentSource: null,
    currentStage: "IDLE",
    totalCardsEstimated: null,
    processedCards: 0,
    totalOffersFound: 0,
    newOffersFound: 0,
    currentCardName: null,
    currentCardImageUrl: null,
    progressPercent: null,
    message: "Monitor ocioso.",
    recentNewOffers: [],
    totalSourcesDone: 0,
    lastUpdatedAt: null
  };
}

function clampProgress(processedCards: number, totalCardsEstimated: number | null): number | null {
  if (!totalCardsEstimated || totalCardsEstimated <= 0) {
    return null;
  }

  const raw = Math.round((processedCards / totalCardsEstimated) * 100);
  return Math.min(100, Math.max(0, raw));
}

function toSnapshot(state: MonitorStatusState): MonitorStatusSnapshot {
  const now = Date.now();
  const startedAt = state.startedAt ? new Date(state.startedAt).getTime() : null;
  const finishedAt = state.finishedAt ? new Date(state.finishedAt).getTime() : null;
  const elapsedMs =
    startedAt == null
      ? 0
      : Math.max(0, (finishedAt ?? now) - startedAt);

  const progressPercent =
    state.progressPercent ??
    clampProgress(state.processedCards, state.totalCardsEstimated);

  let estimatedRemainingMs: number | null = null;
  if (state.isRunning && progressPercent != null && progressPercent > 0 && progressPercent < 100) {
    const totalEstimatedDurationMs = Math.round(elapsedMs / (progressPercent / 100));
    estimatedRemainingMs = Math.max(0, totalEstimatedDurationMs - elapsedMs);
  }

  return {
    ...state,
    progressPercent,
    elapsedMs,
    estimatedRemainingMs
  };
}

export class MonitorStatusService {
  private state: MonitorStatusState = createIdleState();
  private readonly clients = new Map<number, Response>();
  private nextClientId = 1;

  getStatus(): MonitorStatusSnapshot {
    return toSnapshot(this.state);
  }

  reset(): MonitorStatusSnapshot {
    this.state = createIdleState();
    return this.broadcastStatus();
  }

  startRun(input: {
    runId: number;
    startedAt: string;
    totalCardsEstimated?: number | null;
    message?: string;
  }): MonitorStatusSnapshot {
    this.state = {
      ...createIdleState(),
      currentRunId: input.runId,
      runId: input.runId,
      isRunning: true,
      startedAt: input.startedAt,
      currentStage: "STARTING",
      totalCardsEstimated: input.totalCardsEstimated ?? null,
      message: input.message ?? "Iniciando monitoramento...",
      lastUpdatedAt: new Date().toISOString()
    };

    return this.broadcastStatus();
  }

  update(input: Partial<Omit<MonitorStatusState, "recentNewOffers">> & {
    recentNewOffers?: RecentNewOfferSummary[];
  }): MonitorStatusSnapshot {
    this.state = {
      ...this.state,
      ...input,
      recentNewOffers: input.recentNewOffers ?? this.state.recentNewOffers,
      lastUpdatedAt: new Date().toISOString()
    };

    return this.broadcastStatus();
  }

  setStage(
    stage: MonitorStage,
    input: {
      currentSource?: SourceKey | null;
      message?: string;
      totalCardsEstimated?: number | null;
      currentCardName?: string | null;
      currentCardImageUrl?: string | null;
    } = {}
  ): MonitorStatusSnapshot {
    return this.update({
      currentStage: stage,
      currentSource: input.currentSource ?? this.state.currentSource,
      message: input.message ?? this.state.message,
      totalCardsEstimated: input.totalCardsEstimated ?? this.state.totalCardsEstimated,
      currentCardName: input.currentCardName ?? this.state.currentCardName,
      currentCardImageUrl: input.currentCardImageUrl ?? this.state.currentCardImageUrl
    });
  }

  pushRecentNewOffer(offer: RecentNewOfferSummary): MonitorStatusSnapshot {
    const deduped = [offer, ...this.state.recentNewOffers.filter((item) => item.id !== offer.id)].slice(0, 12);
    this.state = {
      ...this.state,
      recentNewOffers: deduped,
      lastUpdatedAt: new Date().toISOString()
    };

    const status = this.getStatus();
    this.broadcast({
      type: "new-offer",
      status,
      offer
    });
    this.broadcast({
      type: "status",
      status
    });
    return status;
  }

  finish(input: {
    stage: "FINISHED" | "FAILED";
    finishedAt: string;
    message: string;
    progressPercent?: number | null;
  }): MonitorStatusSnapshot {
    this.state = {
      ...this.state,
      isRunning: false,
      finishedAt: input.finishedAt,
      currentStage: input.stage,
      message: input.message,
      progressPercent: input.progressPercent ?? (input.stage === "FINISHED" ? 100 : this.state.progressPercent),
      currentCardName: null,
      currentCardImageUrl: null,
      lastUpdatedAt: new Date().toISOString()
    };

    return this.broadcastStatus();
  }

  subscribe(res: Response): () => void {
    const clientId = this.nextClientId;
    this.nextClientId += 1;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(": connected\n\n");

    this.clients.set(clientId, res);
    this.writeEvent(res, {
      type: "status",
      status: this.getStatus()
    });

    let closed = false;

    return () => {
      if (closed) {
        return;
      }
      closed = true;
      this.clients.delete(clientId);
      res.end();
    };
  }

  private broadcastStatus(): MonitorStatusSnapshot {
    const status = this.getStatus();
    this.broadcast({
      type: "status",
      status
    });
    return status;
  }

  private broadcast(payload: MonitorEventPayload): void {
    for (const res of this.clients.values()) {
      this.writeEvent(res, payload);
    }
  }

  private writeEvent(res: Response, payload: MonitorEventPayload): void {
    res.write(`event: ${payload.type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

export const monitorStatusService = new MonitorStatusService();
