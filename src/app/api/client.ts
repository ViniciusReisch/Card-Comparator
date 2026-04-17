export type DashboardResponse = {
  stats: {
    totalRayquazasMonitored: number;
    totalActiveOffers: number;
    newOffersLastRun: number;
    lowestPrice: {
      priceCents: number;
      currency: string;
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
  priceCents: number;
  currency: string;
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

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
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
  getRuns(): Promise<RunsResponse> {
    return request<RunsResponse>("/api/runs");
  },
  runMonitor(): Promise<unknown> {
    return request("/api/monitor/run", {
      method: "POST"
    });
  }
};

