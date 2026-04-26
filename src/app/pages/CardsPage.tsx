import { useEffect, useState } from "react";
import { apiClient, type CardsResponse } from "../api/client";
import { CardGrid } from "../components/CardGrid";

export function CardsPage() {
  const [data, setData] = useState<CardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCards() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (collection) params.set("collection", collection);
      if (source) params.set("source", source);
      params.set("limit", "80");
      const response = await apiClient.getCards(params);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar cards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCards();
  }, []);

  return (
    <section className="stack">
      <div className="topbar">
        <h2 className="topbar-title">Cards monitorados</h2>
        <p className="topbar-sub">
          {data ? `${data.pagination.total} cards encontrados` : "Todos os Rayquazas coletados"}
        </p>
      </div>

      <div className="page-content">
        <div className="stack">
          <div className="panel">
            <div className="cards-filter-grid">
              <div className="filter-group">
                <label className="filter-label">Buscar por nome</label>
                <input
                  className="filter-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rayquaza..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadCards();
                  }}
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">Colecao</label>
                <input
                  className="filter-input"
                  value={collection}
                  onChange={(event) => setCollection(event.target.value)}
                  placeholder="Ex: Deoxys"
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">Fonte</label>
                <select className="filter-select" value={source} onChange={(event) => setSource(event.target.value)}>
                  <option value="">Todas</option>
                  <option value="LIGA_POKEMON">Liga Pokemon</option>
                  <option value="CARDTRADER">CardTrader</option>
                  <option value="MYPCARDS">MYP Cards</option>
                </select>
              </div>
              <div className="filter-group cards-filter-action">
                <button className="btn btn-primary btn-sm" onClick={() => void loadCards()}>
                  Buscar
                </button>
              </div>
            </div>
          </div>

          {error ? <div className="notice notice-error">{error}</div> : null}

          {loading ? (
            <div className="notice">Carregando cards...</div>
          ) : (
            <CardGrid cards={data?.items ?? []} />
          )}
        </div>
      </div>
    </section>
  );
}
