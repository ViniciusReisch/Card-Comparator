import { useEffect, useState } from "react";
import { apiClient, type CardsResponse } from "../api/client";
import { CardGrid } from "../components/CardGrid";

export function CardsPage() {
  const [data, setData] = useState<CardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [source, setSource] = useState("");

  async function loadCards() {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (query) {
        params.set("query", query);
      }
      if (collection) {
        params.set("collection", collection);
      }
      if (source) {
        params.set("source", source);
      }
      params.set("limit", "60");

      const response = await apiClient.getCards(params);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar cards.");
    }
  }

  useEffect(() => {
    void loadCards();
  }, []);

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cards monitorados</p>
            <h3>Todos os Rayquazas encontrados nas fontes configuradas</h3>
          </div>
        </div>

        <div className="filters-inline">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome" />
          <input
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
            placeholder="Filtrar colecao"
          />
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">Todas as fontes</option>
            <option value="LIGA_POKEMON">Liga Pokemon</option>
            <option value="CARDTRADER">CardTrader</option>
          </select>
          <button className="secondary-button" onClick={() => void loadCards()}>
            Aplicar filtros
          </button>
        </div>

        {error ? <div className="notice notice-error">{error}</div> : null}
      </div>

      {data ? <CardGrid cards={data.items} /> : <div className="notice">Carregando cards...</div>}
    </section>
  );
}

