import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient, type CardDetailResponse, type OfferItem, type OffersResponse } from "../api/client";
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
  year: ""
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
      setError("Card invalido.");
      return;
    }

    try {
      setError(null);
      const search = new URLSearchParams();
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) {
          search.set(key, value);
        }
      });
      search.set("limit", "200");

      const [cardResponse, offerResponse] = await Promise.all([
        apiClient.getCardDetail(cardId),
        apiClient.getCardOffers(cardId, search)
      ]);

      setCard(cardResponse);
      setOffers(offerResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar detalhe do card.");
    }
  }

  useEffect(() => {
    void loadData(defaultFilters);
  }, [cardId]);

  const offersBySource = useMemo(() => {
    const grouped = new Map<string, OfferItem[]>();

    for (const offer of offers?.items ?? []) {
      const bucket = grouped.get(offer.source) ?? [];
      bucket.push(offer);
      grouped.set(offer.source, bucket);
    }

    return Array.from(grouped.entries());
  }, [offers]);

  return (
    <section className="stack">
      <Link to="/cards" className="secondary-button back-link">
        Voltar para cards
      </Link>

      {error ? <div className="notice notice-error">{error}</div> : null}

      {!card ? (
        <div className="notice">Carregando card...</div>
      ) : (
        <>
          <div className="detail-hero">
            <div className="detail-image-shell">
              {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : <div className="image-fallback">R</div>}
            </div>
            <div className="detail-copy">
              <p className="eyebrow">Detalhe do card</p>
              <h3>{card.name}</h3>
              <p className="muted">
                {card.setName ?? "Colecao nao identificada"} • {card.year ?? "Ano n/d"} {card.number ? `• #${card.number}` : ""}
              </p>
              <div className="badge-row">
                {card.sources.map((source) => (
                  <SourceBadge key={source} source={source} />
                ))}
              </div>
              <div className="detail-stats">
                <span>{offers?.pagination.total ?? 0} ofertas listadas</span>
                <strong>
                  {card.minPriceCents !== null ? `${(card.minPriceCents / 100).toFixed(2)} ${card.currency ?? ""}` : "Sem preco"}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Filtros</p>
                <h3>Refinar ofertas deste card</h3>
              </div>
            </div>
            <FiltersBar
              values={filters}
              onChange={setFilters}
              onApply={() => {
                void loadData(filters);
              }}
            />
          </div>

          {offersBySource.length === 0 ? (
            <div className="notice">Nenhuma oferta encontrada para este card.</div>
          ) : (
            offersBySource.map(([source, groupedOffers]) => (
              <OfferTable
                key={source}
                title={source === "LIGA_POKEMON" ? "Liga Pokemon" : "CardTrader"}
                offers={groupedOffers}
              />
            ))
          )}
        </>
      )}
    </section>
  );
}

