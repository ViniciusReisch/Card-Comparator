import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiClient,
  formatBrl,
  formatOriginalPrice,
  type OfferItem,
  type OffersResponse
} from "../api/client";
import { ConditionBadge } from "../components/ConditionBadge";
import { FiltersBar, type FilterValues } from "../components/FiltersBar";
import { FinishBadges } from "../components/FinishBadges";
import { LanguageBadge } from "../components/LanguageBadge";
import { NewOfferBadge } from "../components/NewOfferBadge";
import { ScraperProgressBar } from "../components/ScraperProgressBar";
import { SourceBadge } from "../components/SourceBadge";
import { useMonitorStatus } from "../hooks/useMonitorStatus";

const defaultFilters: FilterValues = {
  newOnly: true,
  activeOnly: true,
  source: "",
  language: "",
  condition: "",
  minPrice: "",
  maxPrice: "",
  collection: "",
  year: "",
  search: ""
};
const OFFERS_PAGE_SIZE = 500;

function matchesLiveFilters(offer: OfferItem, filters: FilterValues): boolean {
  if (filters.newOnly && !offer.isNew) return false;
  if (filters.activeOnly && !offer.isActive) return false;
  if (filters.source && offer.source !== filters.source) return false;
  if (filters.language && (offer.languageNormalized ?? "") !== filters.language) return false;
  if (filters.condition && (offer.conditionNormalized ?? "") !== filters.condition) return false;
  if (filters.minPrice) {
    const minPriceCents = Math.round(Number(filters.minPrice) * 100);
    const offerPriceCents = offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : 0);
    if (offerPriceCents < minPriceCents) return false;
  }
  if (filters.maxPrice) {
    const maxPriceCents = Math.round(Number(filters.maxPrice) * 100);
    const offerPriceCents = offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : 0);
    if (offerPriceCents > maxPriceCents) return false;
  }
  if (filters.collection && !(offer.setName ?? "").toLowerCase().includes(filters.collection.toLowerCase())) return false;
  if (filters.year && String(offer.year ?? "") !== filters.year) return false;
  if (filters.search) {
    const haystack = [
      offer.cardName,
      offer.setName,
      offer.sellerName,
      offer.storeName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.search.toLowerCase())) return false;
  }

  return true;
}

function buildOfferSearchParams(filters: FilterValues, page = 1): URLSearchParams {
  const params = new URLSearchParams();
  params.set("newOnly", String(filters.newOnly));
  params.set("activeOnly", String(filters.activeOnly));
  if (filters.source) params.set("source", filters.source);
  if (filters.language) params.set("language", filters.language);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.minPrice) params.set("minPriceBrl", filters.minPrice);
  if (filters.maxPrice) params.set("maxPriceBrl", filters.maxPrice);
  if (filters.collection) params.set("setName", filters.collection);
  if (filters.year) params.set("year", filters.year);
  if (filters.search) params.set("search", filters.search);
  params.set("page", String(page));
  params.set("pageSize", String(OFFERS_PAGE_SIZE));
  params.set("sort", "latest");
  return params;
}

function mergeOfferPages(current: OffersResponse | null, next: OffersResponse): OffersResponse {
  if (!current) return next;

  const seen = new Set<number>();
  const items = [...current.items, ...next.items].filter((offer) => {
    if (seen.has(offer.id)) return false;
    seen.add(offer.id);
    return true;
  });

  return {
    ...next,
    items
  };
}

export function OffersPage() {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [applied, setApplied] = useState<FilterValues>(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const previousRunningRef = useRef(false);

  async function loadOffers(currentFilters = applied, page = 1, append = false) {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const response = await apiClient.getOffers(buildOfferSearchParams(currentFilters, page));
      setData((currentData) => (append ? mergeOfferPages(currentData, response) : response));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar anuncios.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function insertLiveOffer(offer: OfferItem) {
    setData((currentData) => {
      const base = currentData ?? {
        items: [],
        pagination: {
          page: 1,
          limit: OFFERS_PAGE_SIZE,
          total: 0
        }
      };

      const alreadyPresent = base.items.some((item) => item.id === offer.id);
      const withoutDuplicate = base.items.filter((item) => item.id !== offer.id);
      return {
        ...base,
        items: [offer, ...withoutDuplicate],
        pagination: {
          ...base.pagination,
          total: alreadyPresent ? base.pagination.total : base.pagination.total + 1
        }
      };
    });
  }

  const { status } = useMonitorStatus({
    onNewOffer: (offer) => {
      if (!applied.newOnly) {
        return;
      }

      if (matchesLiveFilters(offer, applied)) {
        insertLiveOffer(offer);
      }
    }
  });

  useEffect(() => {
    void loadOffers(defaultFilters);
  }, []);

  useEffect(() => {
    if (!status) {
      return;
    }

    const wasRunning = previousRunningRef.current;
    previousRunningRef.current = status.isRunning;

    if (wasRunning && !status.isRunning) {
      void loadOffers(applied);
    }
  }, [applied, status]);

  function handleApply() {
    setApplied(filters);
    void loadOffers(filters);
  }

  function handleClear() {
    setFilters(defaultFilters);
    setApplied(defaultFilters);
    void loadOffers(defaultFilters);
  }

  function handleLoadMore() {
    if (!data || loadingMore) return;
    void loadOffers(applied, data.pagination.page + 1, true);
  }

  const offers = useMemo<OfferItem[]>(() => data?.items ?? [], [data]);
  const totalOffers = data?.pagination.total ?? 0;
  const hasMore = offers.length < totalOffers;

  return (
    <section className="stack">
      <div className="topbar">
        <h2 className="topbar-title">Anuncios</h2>
        <p className="topbar-sub">
          Central unica de ofertas monitoradas. A tela abre com o filtro de novos anuncios marcado por padrao.
        </p>
      </div>

      <div className="page-content">
        <div className="stack">
          <ScraperProgressBar status={status} />

          <div className="panel">
            <FiltersBar
              values={filters}
              onChange={setFilters}
              onApply={handleApply}
              onClear={handleClear}
              showSearch
              showNewOnlyToggle
              showActiveOnlyToggle
            />
          </div>

          {error ? <div className="notice notice-error">{error}</div> : null}

          {loading ? (
            <div className="panel">
              <div className="notice">Carregando anuncios...</div>
            </div>
          ) : offers.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Nenhum anuncio encontrado</p>
              <p className="muted">Tente ajustar os filtros ou rodar o monitoramento.</p>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div className="panel-header" style={{ padding: "1rem 1.25rem", marginBottom: 0 }}>
                <div>
                  <div className="panel-title">Tabela de anuncios</div>
                  <div className="panel-sub">
                    Exibindo {offers.length} de {totalOffers} anuncios
                    {applied.newOnly ? " - exibindo novos anuncios" : " - exibindo todos os anuncios ativos"}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table ads-table">
                  <thead>
                    <tr>
                      <th>Imagem</th>
                      <th>Carta</th>
                      <th>Colecao / Ano</th>
                      <th>Fonte</th>
                      <th>Idioma</th>
                      <th>Estado</th>
                      <th>Extra</th>
                      <th>Preco</th>
                      <th>Vendedor / Loja</th>
                      <th>Primeira aparicao</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => {
                      const brl = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
                      const original = formatOriginalPrice(offer.priceCents, offer.currency);

                      return (
                        <tr key={offer.id} className={offer.isNew ? "is-new-row" : ""}>
                          <td className="img-cell" data-label="Imagem">
                            <div className="offer-thumb-shell">
                              {offer.imageUrl ? (
                                <img src={offer.imageUrl} alt={offer.cardName} className="offer-thumb-image" />
                              ) : (
                                <div className="img-fallback">R</div>
                              )}
                            </div>
                          </td>
                          <td data-label="Carta">
                            <div className="offer-row-main">
                              <Link to={`/cards/${offer.cardId}`} className="offer-row-title">
                                {offer.cardName}
                              </Link>
                              <div className="badge-row">
                                {offer.isNew ? <NewOfferBadge /> : null}
                                {!offer.isActive ? <span className="badge pill-neutral">Inativo</span> : null}
                              </div>
                            </div>
                          </td>
                          <td data-label="Colecao / Ano">
                            <span className="offer-row-muted">
                              {offer.setName ?? "-"}
                              {offer.year ? ` - ${offer.year}` : ""}
                            </span>
                          </td>
                          <td data-label="Fonte">
                            <SourceBadge source={offer.source} />
                          </td>
                          <td data-label="Idioma">
                            <LanguageBadge value={offer.languageNormalized} />
                          </td>
                          <td data-label="Estado">
                            <ConditionBadge value={offer.conditionNormalized} />
                          </td>
                          <td data-label="Extra">
                            <FinishBadges tags={offer.finishTags} raw={offer.finishRaw} />
                          </td>
                          <td data-label="Preco">
                            <span className="price-brl">{brl}</span>
                            {original ? <span className="price-original">{original}</span> : null}
                          </td>
                          <td data-label="Vendedor / Loja" style={{ fontSize: "0.82rem" }}>
                            {offer.storeName ?? offer.sellerName ?? <span className="muted">-</span>}
                            {offer.sellerCountry ? <div className="price-original">{offer.sellerCountry}</div> : null}
                          </td>
                          <td data-label="Primeira aparicao" style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {format(new Date(offer.firstSeenAt), "dd/MM/yyyy HH:mm")}
                          </td>
                          <td data-label="Link">
                            {offer.offerUrl ? (
                              <a href={offer.offerUrl} target="_blank" rel="noreferrer" className="table-link">
                                Abrir
                              </a>
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span className="muted">
                  {hasMore
                    ? `Ainda existem ${totalOffers - offers.length} anuncios para carregar.`
                    : "Todos os anuncios deste filtro foram carregados."}
                </span>
                {hasMore ? (
                  <button className="btn btn-secondary" type="button" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? "Carregando..." : "Carregar mais anuncios"}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
