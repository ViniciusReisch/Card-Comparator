import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient, formatBrl, type DashboardResponse } from "../api/client";
import { ConditionBadge } from "../components/ConditionBadge";
import { LanguageBadge } from "../components/LanguageBadge";
import { NewOfferBadge } from "../components/NewOfferBadge";
import { SourceBadge } from "../components/SourceBadge";
import { StatCard } from "../components/StatCard";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const navigate = useNavigate();

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getDashboard();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadDashboard(); }, []);

  async function handleRunMonitor() {
    try {
      setIsRunning(true);
      await apiClient.runMonitor();
      await loadDashboard();
      navigate("/runs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar monitor.");
    } finally {
      setIsRunning(false);
    }
  }

  const lowestBrl = data?.stats.lowestPrice
    ? formatBrl(data.stats.lowestPrice.priceBrlCents ?? data.stats.lowestPrice.priceCents)
    : null;

  const langDistrib = data?.distributions?.language ?? [];
  const condDistrib = data?.distributions?.condition ?? [];
  const totalLang = langDistrib.reduce((s, x) => s + x.count, 0);
  const totalCond = condDistrib.reduce((s, x) => s + x.count, 0);

  return (
    <section className="stack">
      <div className="topbar">
        <h2 className="topbar-title">Dashboard</h2>
        <p className="topbar-sub">Visão geral do monitoramento de Rayquaza</p>
      </div>

      <div className="page-content">
        <div className="stack">
          {/* Hero */}
          <div className="hero-banner">
            <div className="hero-content">
              <h2>Monitor Rayquaza TCG</h2>
              <p>Coleta e compara anúncios de cards Rayquaza em Liga Pokémon e CardTrader.</p>
            </div>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={handleRunMonitor} disabled={isRunning}>
                {isRunning ? "Executando..." : "▶ Rodar monitoramento"}
              </button>
              <Link className="btn btn-secondary" to="/new-offers">
                Ver novos anúncios →
              </Link>
            </div>
          </div>

          {error ? <div className="notice notice-error">{error}</div> : null}
          {loading ? <div className="notice">Carregando dados...</div> : null}

          {data && (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <StatCard label="Cards monitorados" value={String(data.stats.totalRayquazasMonitored)} />
                <StatCard label="Ofertas ativas" value={String(data.stats.totalActiveOffers)} />
                <StatCard label="Novos anúncios" value={String(data.stats.newOffersLastRun)} />
                <StatCard
                  label="Menor preço (BRL)"
                  value={lowestBrl ?? "—"}
                  hint={data.stats.lowestPrice?.cardName}
                />
              </div>

              {/* Last run */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Última execução</div>
                  </div>
                  <Link to="/runs" className="btn btn-ghost btn-sm">Ver histórico</Link>
                </div>
                {data.stats.latestRun ? (
                  <div className="run-summary-grid">
                    <div>
                      <span className="label">Status</span>
                      <strong style={{ textTransform: "capitalize" }}>{data.stats.latestRun.status}</strong>
                    </div>
                    <div>
                      <span className="label">Iniciada em</span>
                      <strong>{format(new Date(data.stats.latestRun.startedAt), "dd/MM/yyyy HH:mm")}</strong>
                    </div>
                    <div>
                      <span className="label">Cards coletados</span>
                      <strong>{data.stats.latestRun.totalCardsFound}</strong>
                    </div>
                    <div>
                      <span className="label">Ofertas coletadas</span>
                      <strong>{data.stats.latestRun.totalOffersFound}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="muted">Nenhuma execução concluída ainda. Rode o monitoramento.</p>
                )}
              </div>

              {/* Distributions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Idiomas das ofertas</div>
                  </div>
                  {langDistrib.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Sem dados ainda.</p>
                  ) : (
                    <div className="dist-list">
                      {langDistrib.slice(0, 8).map((item) => (
                        <div key={item.language} className="dist-item">
                          <div className="dist-label">
                            <LanguageBadge value={item.language} />
                          </div>
                          <div className="dist-bar-wrap">
                            <div
                              className="dist-bar"
                              style={{ width: `${Math.round((item.count / totalLang) * 100)}%` }}
                            />
                          </div>
                          <div className="dist-count">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Estados das ofertas</div>
                  </div>
                  {condDistrib.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Sem dados ainda.</p>
                  ) : (
                    <div className="dist-list">
                      {condDistrib.map((item) => (
                        <div key={item.condition} className="dist-item">
                          <div className="dist-label">
                            <ConditionBadge value={item.condition} />
                          </div>
                          <div className="dist-bar-wrap">
                            <div
                              className="dist-bar"
                              style={{
                                width: `${Math.round((item.count / totalCond) * 100)}%`,
                                background: "var(--green)"
                              }}
                            />
                          </div>
                          <div className="dist-count">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent new offers */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Últimos novos anúncios</div>
                  <Link to="/new-offers" className="btn btn-ghost btn-sm">Ver todos</Link>
                </div>

                {data.recentNewOffers.length === 0 ? (
                  <p className="muted">Nenhum anúncio novo no momento.</p>
                ) : (
                  <div className="table-list">
                    {data.recentNewOffers.map((offer) => {
                      const brl = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
                      return (
                        <div key={offer.id} className="list-row">
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div className="badge-row">
                              <SourceBadge source={offer.source} />
                              <LanguageBadge value={offer.languageNormalized} />
                              <ConditionBadge value={offer.conditionNormalized} />
                              {offer.isNew && <NewOfferBadge />}
                            </div>
                            <span className="list-title">
                              <Link to={`/cards/${offer.cardId}`}>{offer.cardName}</Link>
                            </span>
                            <span className="list-subtitle">
                              {offer.setName ?? "Coleção n/d"}
                              {offer.storeName || offer.sellerName ? ` · ${offer.storeName ?? offer.sellerName}` : ""}
                            </span>
                          </div>
                          <div className="list-row-right">
                            <strong className="price-brl">{brl}</strong>
                            <span className="muted" style={{ fontSize: "0.78rem" }}>
                              {format(new Date(offer.firstSeenAt), "dd/MM HH:mm")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
