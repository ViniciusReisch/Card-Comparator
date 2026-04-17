import type { GroupedCardRecord } from "../../db/repositories/card.repository";
import type { OfferListFilters, OfferListRecord } from "../../db/repositories/offer.repository";
import type { MonitorRunRecord, MonitorRunSourceRecord } from "../../db/repositories/run.repository";

function readQueryValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

export function readStringQuery(query: Record<string, unknown>, key: string): string | undefined {
  const value = readQueryValue(query, key);
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function readNumberQuery(query: Record<string, unknown>, key: string): number | undefined {
  const value = readQueryValue(query, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readPage(query: Record<string, unknown>): number {
  return readNumberQuery(query, "page") ?? 1;
}

export function readLimit(query: Record<string, unknown>, fallback: number, max = 100): number {
  const raw = readNumberQuery(query, "limit") ?? fallback;
  return Math.min(Math.max(raw, 1), max);
}

export function buildOfferFilters(
  query: Record<string, unknown>,
  overrides: Partial<OfferListFilters> = {}
): OfferListFilters {
  const minPrice = readNumberQuery(query, "minPrice");
  const maxPrice = readNumberQuery(query, "maxPrice");

  return {
    source: readStringQuery(query, "source"),
    language: readStringQuery(query, "language"),
    condition: readStringQuery(query, "condition"),
    minPriceCents: typeof minPrice === "number" ? Math.round(minPrice * 100) : undefined,
    maxPriceCents: typeof maxPrice === "number" ? Math.round(maxPrice * 100) : undefined,
    collection: readStringQuery(query, "collection"),
    year: readNumberQuery(query, "year"),
    dateFrom: readStringQuery(query, "dateFrom"),
    dateTo: readStringQuery(query, "dateTo"),
    search: readStringQuery(query, "search"),
    onlyNew: overrides.onlyNew ?? false,
    onlyActive: overrides.onlyActive ?? true,
    page: overrides.page ?? readPage(query),
    limit: overrides.limit ?? readLimit(query, 25, 250),
    cardGroup: overrides.cardGroup
  };
}

export function mapGroupedCard(record: GroupedCardRecord) {
  return {
    id: record.id,
    name: record.name,
    setName: record.set_name,
    setCode: record.set_code,
    year: record.year,
    number: record.number,
    imageUrl: record.image_url,
    sources: record.sources ? record.sources.split(",") : [],
    activeOfferCount: record.active_offer_count,
    minPriceCents: record.min_price_cents,
    currency: record.currency
  };
}

export function mapOffer(record: OfferListRecord) {
  return {
    id: record.id,
    cardId: record.origin_card_id,
    source: record.source,
    cardName: record.card_name,
    setName: record.set_name,
    setCode: record.set_code,
    year: record.year,
    number: record.card_number,
    languageRaw: record.language_raw,
    languageNormalized: record.language_normalized,
    conditionRaw: record.condition_raw,
    conditionNormalized: record.condition_normalized,
    priceCents: record.price_cents,
    currency: record.currency,
    priceBrlCents: record.price_brl_cents ?? null,
    exchangeRateToBrl: record.exchange_rate_to_brl ?? null,
    exchangeRateDate: record.exchange_rate_date ?? null,
    imageUrl: record.image_url ?? record.card_image_url,
    offerUrl: record.offer_url,
    sellerName: record.seller_name,
    storeName: record.store_name,
    quantity: record.quantity,
    isNew: Boolean(record.is_new),
    isActive: Boolean(record.is_active),
    firstSeenAt: record.first_seen_at,
    lastSeenAt: record.last_seen_at,
    lastPriceCents: record.last_price_cents
  };
}

export function mapRun(run: MonitorRunRecord, sources: MonitorRunSourceRecord[] = []) {
  return {
    id: run.id,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    status: run.status,
    totalCardsFound: run.total_cards_found,
    totalOffersFound: run.total_offers_found,
    newOffersFound: run.new_offers_found,
    errorMessage: run.error_message,
    sources: sources.map((source) => ({
      id: source.id,
      source: source.source,
      status: source.status,
      cardsFound: source.cards_found,
      offersFound: source.offers_found,
      newOffersFound: source.new_offers_found,
      errorMessage: source.error_message
    }))
  };
}
