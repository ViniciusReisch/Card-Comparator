import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, formatBrl, type DashboardResponse } from "../api/client";
import { ConditionBadge } from "../components/ConditionBadge";
import { LanguageBadge } from "../components/LanguageBadge";
import { NewOfferBadge } from "../components/NewOfferBadge";
import { ScraperProgressBar } from "../components/ScraperProgressBar";
import { SourceBadge } from "../components/SourceBadge";
import { StatCard } from "../components/StatCard";
import { useMonitorStatus } from "../hooks/useMonitorStatus";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringRun, setTriggeringRun] = useState(false);
  const [togglingScheduler, setTogglingScheduler] = useState(false);
  const { status } = useMonitorStatus();
  const previousRunningRef = useRef(false);

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

  useEffect(() => {
    if (!status) {
      return;
    }

    const wasRunning = previousRunningRef.current;
    previousRunningRef.current = status.isRunning;

    if (wasRunning && !status.isRunning) {
      void loadDashboard();
    }
  }, [status]);

  async function handleRunMonitor() {
    try {
      setTriggeringRun(true);
      setError(null);
      await apiClient.runMonitor();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao iniciar monitoramento.");
    } finally {
      setTriggeringRun(false);
    }
  }

  async function handleToggleScheduler() {
    if (!status) {
      return;
    }

    try {
      setTogglingScheduler(true);
      setError(null);
      if (status.schedulerEnabled) {
        await apiClient.pauseMonitor();
      } else {
        await apiClient.resumeMonitor();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao alterar agendador.");
    } finally {
      setTogglingScheduler(false);
    }
  }

  const lowestBrl = data?.stats.lowestPrice
    ? formatBrl(data.stats.lowestPrice.priceBrlCents ?? data.stats.lowestPrice.priceCents)
    : null;

  const languageDistribution = data?.distributions?.language ?? [];
  const conditionDistribution = data?.distributions?.condition ?? [];
  const totalLanguageOffers = languageDistribution.reduce((sum, item) => sum + item.count, 0);
  const totalConditionOffers = conditionDistribution.reduce((sum, item) => sum + item.count, 0);
  const nextRunLabel = status?.nextRunAt
    ? format(new Date(status.nextRunAt), "dd/MM/yyyy HH:mm")
    : status?.isRunning
      ? "apos a execucao atual"
      : "sem proxima execucao";

  return (
    <section className="stack">
      <div className="topbar">
        <h2 className="topbar-title">Dashboard</h2>
        <p className="topbar-sub">Visao geral do monitoramento de Rayquaza.</p>
      </div>

      <div className="page-content">
        <div className="stack">
          <div className="hero-banner">
            <div className="hero-content">
              <h2>Monitor Rayquaza TCG</h2>
              <p>Coleta e compara anuncios de cards Rayquaza em Liga Pokemon e CardTrader.</p>
            </div>
            <div className="hero-control-stack">
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={handleRunMonitor} disabled={triggeringRun || status?.isRunning}>
                  {status?.isRunning ? "Monitorando..." : triggeringRun ? "Iniciando..." : "Rodar monitoramento agora"}
                </button>
                <button className="btn btn-secondary" onClick={handleToggleScheduler} disabled={!status || togglingScheduler}>
                  {status?.schedulerEnabled ? "Pausar agendador" : "Retomar agendador"}
                </button>
                <Link className="btn btn-secondary" to="/offers">
                  Ver anuncios
                </Link>
              </div>
              <div className="hero-status-line">
                Agendador {status?.schedulerEnabled ? "ativo" : "pausado"} - proxima: {nextRunLabel}
              </div>
            </div>
          </div>

          <ScraperProgressBar status={status} />

          {error ? <div className="notice notice-error">{error}</div> : null}
          {loading ? <div className="notice">Carregando dados...</div> : null}

          {data ? (
            <>
              <div className="stats-grid">
                <StatCard label="Cards monitorados" value={String(data.stats.totalRayquazasMonitored)} />
                <StatCard label="Ofertas ativas" value={String(data.stats.totalActiveOffers)} />
                <StatCard label="Novos anuncios" value={String(data.stats.newOffersLastRun)} />
                <StatCard
                  label="Menor preco (BRL)"
                  value={lowestBrl ?? "-"}
                  hint={data.stats.lowestPrice?.cardName}
                />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Ultima execucao</div>
                  </div>
                  <Link to="/runs" className="btn btn-ghost btn-sm">
                    Ver historico
                  </Link>
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
                  <p className="muted">Nenhuma execucao concluida ainda.</p>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Idiomas das ofertas</div>
                  </div>
                  {languageDistribution.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Sem dados ainda.</p>
                  ) : (
                    <div className="dist-list">
                      {languageDistribution.slice(0, 8).map((item) => (
                        <div key={item.language} className="dist-item">
                          <div className="dist-label">
                            <LanguageBadge value={item.language} />
                          </div>
                          <div className="dist-bar-wrap">
                            <div
                              className="dist-bar"
                              style={{ width: `${Math.round((item.count / totalLanguageOffers) * 100)}%` }}
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
                  {conditionDistribution.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Sem dados ainda.</p>
                  ) : (
                    <div className="dist-list">
                      {conditionDistribution.map((item) => (
                        <div key={item.condition} className="dist-item">
                          <div className="dist-label">
                            <ConditionBadge value={item.condition} />
                          </div>
                          <div className="dist-bar-wrap">
                            <div
                              className="dist-bar"
                              style={{
                                width: `${Math.round((item.count / totalConditionOffers) * 100)}%`,
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

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Ultimos novos anuncios</div>
                  <Link to="/offers" className="btn btn-ghost btn-sm">
                    Ver todos
                  </Link>
                </div>

                {data.recentNewOffers.length === 0 ? (
                  <p className="muted">Nenhum anuncio novo no momento.</p>
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
                              {offer.isNew ? <NewOfferBadge /> : null}
                            </div>
                            <span className="list-title">
                              <Link to={`/cards/${offer.cardId}`}>{offer.cardName}</Link>
                            </span>
                            <span className="list-subtitle">
                              {offer.setName ?? "Colecao n/d"}
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
          ) : null}
        </div>
      </div>
    </section>
  );
}
