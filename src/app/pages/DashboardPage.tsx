import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient, type DashboardResponse } from "../api/client";
import { SourceBadge } from "../components/SourceBadge";
import { StatCard } from "../components/StatCard";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunningMonitor, setIsRunningMonitor] = useState(false);
  const navigate = useNavigate();

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getDashboard();
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleRunMonitor() {
    try {
      setIsRunningMonitor(true);
      await apiClient.runMonitor();
      await loadDashboard();
      navigate("/runs");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao executar monitor.");
    } finally {
      setIsRunningMonitor(false);
    }
  }

  return (
    <section className="stack">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Visao geral</p>
          <h3>Monitore novas ofertas de Rayquaza com foco nas aparicoes mais recentes.</h3>
          <p className="muted">
            O sistema coleta paginas publicas, salva cards e ofertas em SQLite e prepara o destaque para anuncios novos.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={handleRunMonitor} disabled={isRunningMonitor}>
            {isRunningMonitor ? "Executando..." : "Rodar monitoramento agora"}
          </button>
          <Link className="secondary-button" to="/new-offers">
            Ver novos anuncios
          </Link>
        </div>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}
      {loading ? <div className="notice">Carregando dashboard...</div> : null}

      {data ? (
        <>
          <div className="stats-grid">
            <StatCard label="Total de Rayquazas" value={String(data.stats.totalRayquazasMonitored)} />
            <StatCard label="Ofertas ativas" value={String(data.stats.totalActiveOffers)} />
            <StatCard label="Novas na ultima execucao" value={String(data.stats.newOffersLastRun)} />
            <StatCard
              label="Menor preco encontrado"
              value={
                data.stats.lowestPrice
                  ? `${(data.stats.lowestPrice.priceCents / 100).toFixed(2)} ${data.stats.lowestPrice.currency}`
                  : "Sem ofertas"
              }
              hint={data.stats.lowestPrice?.cardName}
            />
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Ultima execucao</p>
                <h3>Resumo mais recente</h3>
              </div>
            </div>
            {data.stats.latestRun ? (
              <div className="run-summary-grid">
                <div>
                  <span className="muted">Status</span>
                  <strong>{data.stats.latestRun.status}</strong>
                </div>
                <div>
                  <span className="muted">Iniciada em</span>
                  <strong>{format(new Date(data.stats.latestRun.startedAt), "dd/MM/yyyy HH:mm")}</strong>
                </div>
                <div>
                  <span className="muted">Cards</span>
                  <strong>{data.stats.latestRun.totalCardsFound}</strong>
                </div>
                <div>
                  <span className="muted">Ofertas</span>
                  <strong>{data.stats.latestRun.totalOffersFound}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Nenhuma execucao concluida ainda.</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Novidades recentes</p>
                <h3>Ultimos anuncios novos detectados</h3>
              </div>
            </div>

            {data.recentNewOffers.length === 0 ? (
              <p className="muted">Nenhum anuncio novo disponivel no momento.</p>
            ) : (
              <div className="table-list">
                {data.recentNewOffers.map((offer) => (
                  <article key={offer.id} className="list-row">
                    <div>
                      <div className="badge-row">
                        <SourceBadge source={offer.source} />
                      </div>
                      <h4>{offer.cardName}</h4>
                      <p className="muted">
                        {offer.setName ?? "Colecao nao identificada"} • {offer.storeName ?? offer.sellerName ?? "Loja nao informada"}
                      </p>
                    </div>
                    <div className="list-row-right">
                      <strong>{(offer.priceCents / 100).toFixed(2)} {offer.currency}</strong>
                      <span className="muted">{format(new Date(offer.firstSeenAt), "dd/MM HH:mm")}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
