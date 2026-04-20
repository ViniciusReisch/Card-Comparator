export type DashboardResponse = {
  stats: {
    totalRayquazasMonitored: number;
    totalActiveOffers: number;
    newOffersLastRun: number;
    lowestPrice: {
      priceCents: number;
      currency: string;
      priceBrlCents: number | null;
      cardName: string;
      source: string;
      offerUrl: string | null;
    } | null;
    latestRun: {
      id: number;
      startedAt: string;
      finishedAt: string | null;
      status: string;
      totalCardsFound: number;
      totalOffersFound: number;
      newOffersFound: number;
      errorMessage: string | null;
      sources: Array<{
        id: number;
        source: string;
        status: string;
        cardsFound: number;
        offersFound: number;
        newOffersFound: number;
        errorMessage: string | null;
      }>;
    } | null;
  };
  recentNewOffers: OfferItem[];
  distributions?: {
    language: Array<{ language: string; count: number }>;
    condition: Array<{ condition: string; count: number }>;
  };
};

export type CardItem = {
  id: number;
  name: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  imageUrl: string | null;
  sources: string[];
  activeOfferCount: number;
  minPriceCents: number | null;
  currency: string | null;
};

export type OfferItem = {
  id: number;
  cardId: number;
  source: string;
  cardName: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  languageRaw: string | null;
  languageNormalized: string | null;
  conditionRaw: string | null;
  conditionNormalized: string | null;
  finishRaw: string | null;
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
  firstSeenRunId: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastPriceCents: number | null;
};

export type OffersResponse = {
  items: OfferItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  card?: CardItem;
};

export type CardDetailResponse = CardItem & {
  offersCount: number;
  latestOffers: OfferItem[];
};

export type CardsResponse = {
  items: CardItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

export type RunsResponse = {
  items: Array<{
    id: number;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    totalCardsFound: number;
    totalOffersFound: number;
    newOffersFound: number;
    errorMessage: string | null;
    sources: Array<{
      id: number;
      source: string;
      status: string;
      cardsFound: number;
      offersFound: number;
      newOffersFound: number;
      errorMessage: string | null;
    }>;
  }>;
};

export type MonitorStatusResponse = {
  currentRunId: number | null;
  runId: number | null;
  isRunning: boolean;
  schedulerEnabled: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  nextRunAt: string | null;
  currentSource: string | null;
  currentStage: string;
  totalCardsEstimated: number | null;
  processedCards: number;
  totalOffersFound: number;
  newOffersFound: number;
  currentCardName: string | null;
  currentCardImageUrl: string | null;
  progressPercent: number | null;
  message: string;
  recentNewOffers: OfferItem[];
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  totalSourcesDone: number;
  lastUpdatedAt: string | null;
};

export type MonitorEventPayload =
  | {
      type: "status";
      status: MonitorStatusResponse;
    }
  | {
      type: "new-offer";
      status: MonitorStatusResponse;
      offer: OfferItem;
    };

export function formatBrl(priceCents: number | null | undefined): string {
  if (priceCents == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceCents / 100);
}

export function formatOriginalPrice(priceCents: number, currency: string): string {
  if (currency === "BRL" || currency === "UNKNOWN") return "";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(priceCents / 100);
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${currency}`;
  }
}

export function getPrimaryPrice(offer: { priceCents: number; currency: string; priceBrlCents?: number | null }): string {
  if (offer.priceBrlCents && offer.priceBrlCents > 0) return formatBrl(offer.priceBrlCents);
  if (offer.currency === "BRL") return formatBrl(offer.priceCents);
  return formatBrl(offer.priceCents);
}

export function formatElapsed(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

export const apiBaseUrl = configuredApiBaseUrl;
export const monitorEventsUrl = `${apiBaseUrl}/api/monitor/events`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  getDashboard(): Promise<DashboardResponse> {
    return request<DashboardResponse>("/api/dashboard");
  },
  getCards(searchParams?: URLSearchParams): Promise<CardsResponse> {
    const suffix = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    return request<CardsResponse>(`/api/cards${suffix}`);
  },
  getCardDetail(cardId: number): Promise<CardDetailResponse> {
    return request<CardDetailResponse>(`/api/cards/${cardId}`);
  },
  getCardOffers(cardId: number, searchParams?: URLSearchParams): Promise<OffersResponse> {
    const suffix = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    return request<OffersResponse>(`/api/cards/${cardId}/offers${suffix}`);
  },
  getNewOffers(searchParams?: URLSearchParams): Promise<OffersResponse> {
    const suffix = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    return request<OffersResponse>(`/api/offers/new${suffix}`);
  },
  getOffers(searchParams?: URLSearchParams): Promise<OffersResponse> {
    const suffix = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    return request<OffersResponse>(`/api/offers${suffix}`);
  },
  getRecentNewOffers(limit = 12): Promise<{ items: OfferItem[] }> {
    return request<{ items: OfferItem[] }>(`/api/offers/recent-new?limit=${limit}`);
  },
  getRuns(): Promise<RunsResponse> {
    return request<RunsResponse>("/api/runs");
  },
  getMonitorStatus(): Promise<MonitorStatusResponse> {
    return request<MonitorStatusResponse>("/api/monitor/status");
  },
  runMonitor(): Promise<MonitorStatusResponse> {
    return request<MonitorStatusResponse>("/api/monitor/run", { method: "POST" });
  },
  pauseMonitor(): Promise<MonitorStatusResponse> {
    return request<MonitorStatusResponse>("/api/monitor/pause", { method: "POST" });
  },
  resumeMonitor(): Promise<MonitorStatusResponse> {
    return request<MonitorStatusResponse>("/api/monitor/resume", { method: "POST" });
  }
};
