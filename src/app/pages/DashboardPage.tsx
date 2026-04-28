import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, formatBrl, type DashboardResponse } from "../api/client";
import { ConditionBadge } from "../components/ConditionBadge";
import { LanguageBadge } from "../components/LanguageBadge";
import { NewOfferBadge } from "../components/NewOfferBadge";
import { ScraperProgressBar } from "../components/ScraperProgressBar";
import { SourceBadge } from "../components/SourceBadge";
import { SourceSelector } from "../components/SourceSelector";
import { StatCard } from "../components/StatCard";
import { useAppConfig } from "../hooks/useAppConfig";
import { useMonitorStatus } from "../hooks/useMonitorStatus";

export function DashboardPage() {
  const config = useAppConfig();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringRun, setTriggeringRun] = useState(false);
  const [togglingScheduler, setTogglingScheduler] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [pendingRun, setPendingRun] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const { status } = useMonitorStatus();
  const previousRunningRef = useRef(false);

  // Inicializa selectedSources com todas as fontes habilitadas quando config carregar
  useEffect(() => {
    if (config.sources.length > 0 && selectedSources.length === 0) {
      setSelectedSources(config.sources.filter((s) => s.enabled).map((s) => s.id));
    }
  }, [config.sources]);

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
    if (selectedSources.length === 0) {
      setError("Selecione pelo menos uma loja para monitorar.");
      return;
    }

    try {
      setTriggeringRun(true);
      setError(null);
      setPendingRun(false);
      await apiClient.runMonitor({ sources: selectedSources });
    } catch (requestError) {
      // 409 = já existe uma run ativa; trata como pending amigável
      if (requestError instanceof Error && /already in progress/i.test(requestError.message)) {
        setPendingRun(true);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Falha ao iniciar monitoramento.");
      }
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

  async function handleTestNotifications() {
    try {
      setTestingNotifications(true);
      setError(null);
      setNotificationMessage(null);
      const response = await apiClient.testNotifications();
      const sent = response.results.filter((result) => result.status === "sent").length;
      const failed = response.results.filter((result) => result.status === "failed").length;
      setNotificationMessage(`${sent} enviada(s), ${failed} falha(s).`);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao testar notificacoes.");
    } finally {
      setTestingNotifications(false);
    }
  }

  const lowestBrl = data?.stats.lowestPrice
    ? formatBrl(data.stats.lowestPrice.priceBrlCents ?? data.stats.lowestPrice.priceCents)
    : null;

  const sourceDistribution = data?.distributions?.source ?? [];
  const languageDistribution = data?.distributions?.language ?? [];
  const conditionDistribution = data?.distributions?.condition ?? [];
  const totalSourceOffers = sourceDistribution.reduce((sum, item) => sum + item.count, 0);
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
              <img className="hero-logo" src="/rayquaza-logo.png" alt="Rayquaza Monitor" />
              <p>Coleta e compara anuncios de cards Rayquaza em Liga Pokemon, CardTrader e MYP Cards.</p>
            </div>
            <div className="hero-control-stack">
              <SourceSelector
                sources={config.sources}
                selected={selectedSources}
                onChange={setSelectedSources}
                disabled={triggeringRun || status?.isRunning}
              />
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={handleRunMonitor} disabled={triggeringRun || status?.isRunning || selectedSources.length === 0}>
                  {status?.isRunning ? "Monitorando..." : triggeringRun ? "Iniciando..." : "Rodar monitoramento agora"}
                </button>
                {!config.betaSafeMode && (
                  <button className="btn btn-secondary" onClick={handleToggleScheduler} disabled={!status || togglingScheduler}>
                    {status?.schedulerEnabled ? "Pausar agendador" : "Retomar agendador"}
                  </button>
                )}
                <Link className="btn btn-secondary" to="/offers">
                  Ver anuncios
                </Link>
              </div>
              {!config.betaSafeMode && (
                <div className="hero-status-line">
                  Agendador {status?.schedulerEnabled ? "ativo" : "pausado"} - proxima: {nextRunLabel}
                </div>
              )}
              {pendingRun && (
                <div className="notice" style={{ marginTop: "0.5rem" }}>
                  Ja existe uma execucao em andamento. Esta execucao sera iniciada automaticamente ao final.
                </div>
              )}
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
                <StatCard label="Notificacoes enviadas" value={String(data.notifications.lastRunSentCount)} />
                <StatCard
                  label="Menor preco (BRL)"
                  value={lowestBrl ?? "-"}
                  hint={data.stats.lowestPrice?.cardName}
                />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Notificacoes</div>
                    <div className="panel-sub">
                      ntfy {data.notifications.providers.ntfy.enabled ? "habilitado" : "desabilitado"} - Telegram{" "}
                      {data.notifications.providers.telegram.enabled ? "habilitado" : "desabilitado"}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={handleTestNotifications} disabled={testingNotifications}>
                    {testingNotifications ? "Testando..." : "Enviar teste"}
                  </button>
                </div>

                <div className="run-summary-grid">
                  <div>
                    <span className="label">ntfy</span>
                    <strong>{data.notifications.providers.ntfy.configured ? "configurado" : "sem topico"}</strong>
                  </div>
                  <div>
                    <span className="label">Telegram</span>
                    <strong>{data.notifications.providers.telegram.configured ? "configurado" : "sem chat"}</strong>
                  </div>
                  <div>
                    <span className="label">Ultima execucao</span>
                    <strong>{data.notifications.lastRunSentCount}</strong>
                  </div>
                  <div>
                    <span className="label">Por provider</span>
                    <strong>
                      ntfy {data.notifications.lastRunSentByProvider.ntfy} / Telegram{" "}
                      {data.notifications.lastRunSentByProvider.telegram}
                    </strong>
                  </div>
                </div>

                {notificationMessage ? <p className="muted" style={{ marginTop: "0.75rem" }}>{notificationMessage}</p> : null}
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

              <div className="split-grid">
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Fontes das ofertas</div>
                  </div>
                  {sourceDistribution.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Sem dados ainda.</p>
                  ) : (
                    <div className="dist-list">
                      {sourceDistribution.map((item) => (
                        <div key={item.source} className="dist-item">
                          <div className="dist-label">
                            <SourceBadge source={item.source} />
                          </div>
                          <div className="dist-bar-wrap">
                            <div
                              className="dist-bar"
                              style={{ width: `${Math.round((item.count / totalSourceOffers) * 100)}%` }}
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
                              {offer.storeName || offer.sellerName ? ` - ${offer.storeName ?? offer.sellerName}` : ""}
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
