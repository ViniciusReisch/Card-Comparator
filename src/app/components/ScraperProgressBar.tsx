import { Link } from "react-router-dom";
import {
  formatBrl,
  formatElapsed,
  getPrimaryPrice,
  type MonitorStatusResponse
} from "../api/client";
import { ConditionBadge } from "./ConditionBadge";
import { LanguageBadge } from "./LanguageBadge";
import { NewOfferBadge } from "./NewOfferBadge";
import { SourceBadge } from "./SourceBadge";

type ScraperProgressBarProps = {
  status: MonitorStatusResponse | null;
  showRecentOffers?: boolean;
};

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    IDLE: "Ocioso",
    STARTING: "Iniciando",
    LOADING_LIGA_RESULTS: "Abrindo Liga Pokemon",
    EXPANDING_LIGA_LOAD_MORE: "Expandindo resultados da Liga Pokemon",
    COLLECTING_LIGA_CARDS: "Catalogando cards da Liga Pokemon",
    SCRAPING_LIGA_CARD_DETAILS: "Coletando detalhes da Liga Pokemon",
    LOADING_CARDTRADER_RESULTS: "Abrindo CardTrader",
    PAGINATING_CARDTRADER: "Resolvendo lista do CardTrader",
    COLLECTING_CARDTRADER_CARDS: "Catalogando cards do CardTrader",
    SCRAPING_CARDTRADER_CARD_DETAILS: "Coletando detalhes do CardTrader",
    SAVING_RESULTS: "Salvando resultados",
    FINISHED: "Concluido",
    FAILED: "Falhou"
  };

  return labels[stage] ?? stage;
}

function sourceLabel(source: string | null): string {
  if (source === "LIGA_POKEMON") return "Liga Pokemon";
  if (source === "CARDTRADER") return "CardTrader";
  return "Monitor";
}

export function ScraperProgressBar({ status, showRecentOffers = true }: ScraperProgressBarProps) {
  if (!status) {
    return null;
  }

  const shouldShow =
    status.isRunning ||
    status.currentStage === "FINISHED" ||
    status.currentStage === "FAILED";

  if (!shouldShow) {
    return null;
  }

  const hasPercent = typeof status.progressPercent === "number";
  const progressStyle = hasPercent ? { width: `${status.progressPercent}%` } : undefined;

  return (
    <section
      className={`panel monitor-progress ${status.isRunning ? "is-running" : ""} ${
        status.currentStage === "FAILED" ? "is-failed" : ""
      } ${status.currentStage === "FINISHED" ? "is-finished" : ""}`}
    >
      <div className="monitor-progress-header">
        <div className="monitor-progress-copy">
          <p className="eyebrow">Monitor em tempo real</p>
          <h3 className="panel-title">
            {sourceLabel(status.currentSource)} · {stageLabel(status.currentStage)}
          </h3>
          <p className="panel-sub">{status.message}</p>
        </div>

        <div className="monitor-progress-card">
          {status.currentCardImageUrl ? (
            <img src={status.currentCardImageUrl} alt={status.currentCardName ?? "Card atual"} />
          ) : (
            <div className="image-fallback">R</div>
          )}
        </div>
      </div>

      <div className="monitor-progress-meta">
        <span>{status.currentCardName ?? "Aguardando card atual..."}</span>
        <span>
          {status.totalCardsEstimated
            ? `${status.processedCards}/${status.totalCardsEstimated} cards`
            : `${status.processedCards} cards processados`}
        </span>
      </div>

      <div className={`progress-track ${hasPercent ? "" : "is-indeterminate"}`}>
        <div className="progress-fill" style={progressStyle} />
      </div>

      <div className="monitor-progress-stats">
        <span>{status.totalOffersFound} ofertas encontradas</span>
        <span>{status.newOffersFound} novos anuncios</span>
        <span>tempo decorrido: {formatElapsed(status.elapsedMs)}</span>
        <span>
          tempo restante: {status.estimatedRemainingMs != null ? formatElapsed(status.estimatedRemainingMs) : "estimando..."}
        </span>
      </div>

      {showRecentOffers && status.recentNewOffers.length > 0 ? (
        <div className="live-offers-section">
          <div className="panel-header" style={{ marginBottom: "0.75rem" }}>
            <div>
              <div className="panel-title">Novos cadastrados agora</div>
              <div className="panel-sub">Entram na tabela principal sem esperar o monitor terminar.</div>
            </div>
          </div>

          <div className="live-offers-list">
            {status.recentNewOffers.map((offer) => (
              <article key={offer.id} className="live-offer-card">
                <div className="live-offer-thumb">
                  {offer.imageUrl ? (
                    <img src={offer.imageUrl} alt={offer.cardName} />
                  ) : (
                    <div className="image-fallback">R</div>
                  )}
                </div>
                <div className="live-offer-body">
                  <div className="badge-row">
                    <SourceBadge source={offer.source} />
                    <LanguageBadge value={offer.languageNormalized} />
                    <ConditionBadge value={offer.conditionNormalized} />
                    <NewOfferBadge />
                  </div>
                  <Link to={`/cards/${offer.cardId}`} className="list-title">
                    {offer.cardName}
                  </Link>
                  <div className="list-subtitle">
                    {offer.setName ?? "Colecao n/d"}
                    {offer.storeName || offer.sellerName ? ` · ${offer.storeName ?? offer.sellerName}` : ""}
                  </div>
                </div>
                <div className="live-offer-price">
                  <strong className="price-brl">{getPrimaryPrice(offer)}</strong>
                  {offer.offerUrl ? (
                    <a href={offer.offerUrl} target="_blank" rel="noreferrer" className="table-link">
                      Abrir
                    </a>
                  ) : (
                    <span className="muted">{formatBrl(null)}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
