import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, formatBrl, formatOriginalPrice, type OfferItem, type OffersResponse } from "../api/client";
import { ConditionBadge } from "../components/ConditionBadge";
import { FiltersBar } from "../components/FiltersBar";
import { LanguageBadge } from "../components/LanguageBadge";
import { NewOfferBadge } from "../components/NewOfferBadge";
import { SourceBadge } from "../components/SourceBadge";

const defaultFilters = {
  source: "",
  language: "",
  condition: "",
  minPrice: "",
  maxPrice: "",
  collection: "",
  year: "",
  search: ""
};

export function NewOffersPage() {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  async function loadOffers(f = applied) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(f)) {
        if (value) params.set(key, value);
      }
      params.set("limit", "100");
      const response = await apiClient.getNewOffers(params);
      setData(response);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOffers(defaultFilters); }, []);

  function handleApply() {
    setApplied(filters);
    void loadOffers(filters);
  }

  function handleClear() {
    setFilters(defaultFilters);
    setApplied(defaultFilters);
    void loadOffers(defaultFilters);
  }

  const offers = useMemo<OfferItem[]>(() => data?.items ?? [], [data]);

  return (
    <section className="stack">
      <div className="topbar">
        <h2 className="topbar-title">Novos Anúncios</h2>
        <p className="topbar-sub">
          Ofertas detectadas pela primeira vez na última execução do monitor.
          {data ? ` ${data.pagination.total} encontrados.` : ""}
        </p>
      </div>

      <div className="page-content">
        <div className="stack">
          <div className="panel">
            <FiltersBar
              values={filters}
              onChange={setFilters}
              onApply={handleApply}
              onClear={handleClear}
              showSearch
            />
          </div>

          {error ? <div className="notice notice-error">{error}</div> : null}

          {loading ? (
            <div className="panel">
              <div className="notice">Carregando novos anúncios...</div>
            </div>
          ) : offers.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</p>
              <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Nenhum anúncio novo encontrado</p>
              <p className="muted">Tente limpar os filtros ou rodar o monitoramento.</p>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-wrap">
                <table className="data-table new-offers-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Carta</th>
                      <th>Coleção / Ano</th>
                      <th>Fonte</th>
                      <th>Idioma</th>
                      <th>Estado</th>
                      <th>Preço</th>
                      <th>Vendedor / Loja</th>
                      <th>Primeira aparição</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => {
                      const brl = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
                      const orig = formatOriginalPrice(offer.priceCents, offer.currency);
                      return (
                        <tr key={offer.id}>
                          <td className="img-cell">
                            {offer.imageUrl
                              ? <img src={offer.imageUrl} alt={offer.cardName} />
                              : <div className="img-fallback">R</div>}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                              <Link
                                to={`/cards/${offer.cardId}`}
                                style={{ fontWeight: 600, fontSize: "0.875rem" }}
                              >
                                {offer.cardName}
                              </Link>
                              {offer.isNew && <NewOfferBadge />}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                              {offer.setName ?? "—"}
                              {offer.year ? ` · ${offer.year}` : ""}
                            </span>
                          </td>
                          <td><SourceBadge source={offer.source} /></td>
                          <td><LanguageBadge value={offer.languageNormalized} /></td>
                          <td><ConditionBadge value={offer.conditionNormalized} /></td>
                          <td>
                            <span className="price-brl">{brl}</span>
                            {orig && <span className="price-original">{orig}</span>}
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>
                            {offer.storeName ?? offer.sellerName ?? <span className="muted">—</span>}
                          </td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {format(new Date(offer.firstSeenAt), "dd/MM/yyyy HH:mm")}
                          </td>
                          <td>
                            {offer.offerUrl ? (
                              <a href={offer.offerUrl} target="_blank" rel="noreferrer" className="table-link">
                                Abrir ↗
                              </a>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
