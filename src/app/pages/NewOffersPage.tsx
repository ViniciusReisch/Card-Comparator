import { useEffect, useMemo, useState } from "react";
import { apiClient, type OfferItem, type OffersResponse } from "../api/client";
import { FiltersBar } from "../components/FiltersBar";
import { OfferCard } from "../components/OfferCard";

const defaultFilters = {
  source: "",
  language: "",
  condition: "",
  minPrice: "",
  maxPrice: "",
  collection: "",
  year: ""
};

export function NewOffersPage() {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [error, setError] = useState<string | null>(null);

  async function loadOffers(currentFilters = filters) {
    try {
      setError(null);
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      params.set("limit", "80");

      const response = await apiClient.getNewOffers(params);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar novos anuncios.");
    }
  }

  useEffect(() => {
    void loadOffers(defaultFilters);
  }, []);

  const offers = useMemo<OfferItem[]>(() => data?.items ?? [], [data]);

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tela principal</p>
            <h3>Novos anuncios detectados</h3>
            <p className="muted">
              Prioriza ofertas vistas pela primeira vez na ultima execucao e destaca visualmente o que acabou de aparecer.
            </p>
          </div>
        </div>

        <FiltersBar
          values={filters}
          onChange={setFilters}
          onApply={() => {
            void loadOffers(filters);
          }}
        />
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}

      {!data ? (
        <div className="notice">Carregando novos anuncios...</div>
      ) : offers.length === 0 ? (
        <div className="notice">Nenhum anuncio novo encontrado com os filtros atuais.</div>
      ) : (
        <div className="offer-grid">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </section>
  );
}

