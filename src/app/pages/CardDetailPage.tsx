import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient, formatBrl, type CardDetailResponse, type OfferItem, type OffersResponse } from "../api/client";
import { FiltersBar } from "../components/FiltersBar";
import { OfferTable } from "../components/OfferTable";
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

export function CardDetailPage() {
  const params = useParams();
  const cardId = Number(params.id);
  const [card, setCard] = useState<CardDetailResponse | null>(null);
  const [offers, setOffers] = useState<OffersResponse | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [error, setError] = useState<string | null>(null);

  async function loadData(currentFilters = filters) {
    if (!Number.isFinite(cardId)) {
      setError("Card inválido.");
      return;
    }

    try {
      setError(null);
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(currentFilters)) {
        if (value) search.set(key, value);
      }
      search.set("limit", "200");

      const [cardResponse, offerResponse] = await Promise.all([
        apiClient.getCardDetail(cardId),
        apiClient.getCardOffers(cardId, search)
      ]);

      setCard(cardResponse);
      setOffers(offerResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar detalhe do card.");
    }
  }

  useEffect(() => { void loadData(defaultFilters); }, [cardId]);

  const offersBySource = useMemo(() => {
    const grouped = new Map<string, OfferItem[]>();
    for (const offer of offers?.items ?? []) {
      const bucket = grouped.get(offer.source) ?? [];
      bucket.push(offer);
      grouped.set(offer.source, bucket);
    }
    return Array.from(grouped.entries());
  }, [offers]);

  const minBrl = card?.minPriceCents != null ? formatBrl(card.minPriceCents) : null;

  return (
    <section className="stack">
      <div className="topbar">
        <Link to="/cards" className="btn btn-ghost btn-sm" style={{ marginBottom: "0.75rem" }}>
          ← Voltar
        </Link>
        <h2 className="topbar-title">{card?.name ?? "Carregando..."}</h2>
      </div>

      <div className="page-content">
        <div className="stack">
          {error && <div className="notice notice-error">{error}</div>}

          {!card ? (
            <div className="notice">Carregando card...</div>
          ) : (
            <>
              <div className="detail-hero">
                <div className="detail-image-shell">
                  {card.imageUrl
                    ? <img src={card.imageUrl} alt={card.name} />
                    : <div className="image-fallback" style={{ height: "100%" }}>R</div>}
                </div>
                <div className="detail-copy">
                  <p className="eyebrow">Detalhe do card</p>
                  <h3 className="detail-title">{card.name}</h3>
                  <p className="detail-subtitle">
                    {card.setName ?? "Coleção não identificada"}
                    {card.year ? ` · ${card.year}` : ""}
                    {card.number ? ` · #${card.number}` : ""}
                  </p>
                  <div className="badge-row">
                    {card.sources.map((source) => (
                      <SourceBadge key={source} source={source} />
                    ))}
                  </div>
                  <div className="detail-stats">
                    <span className="muted">{offers?.pagination.total ?? 0} ofertas encontradas</span>
                    {minBrl && (
                      <div>
                        <span className="muted" style={{ fontSize: "0.75rem", marginRight: "0.3rem" }}>A partir de</span>
                        <strong className="price-brl" style={{ fontSize: "1.1rem" }}>{minBrl}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Filtrar ofertas</div>
                </div>
                <FiltersBar
                  values={filters}
                  onChange={setFilters}
                  onApply={() => { void loadData(filters); }}
                  onClear={() => {
                    setFilters(defaultFilters);
                    void loadData(defaultFilters);
                  }}
                />
              </div>

              {offersBySource.length === 0 ? (
                <div className="notice">Nenhuma oferta encontrada para este card com os filtros atuais.</div>
              ) : (
                offersBySource.map(([source, groupedOffers]) => (
                  <OfferTable
                    key={source}
                    title={source === "LIGA_POKEMON" ? "Liga Pokémon" : "CardTrader"}
                    offers={groupedOffers}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
