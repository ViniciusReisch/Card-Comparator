import { format } from "date-fns";
import { Link } from "react-router-dom";
import type { OfferItem } from "../api/client";
import { ConditionBadge } from "./ConditionBadge";
import { LanguageBadge } from "./LanguageBadge";
import { NewOfferBadge } from "./NewOfferBadge";
import { SourceBadge } from "./SourceBadge";

type OfferCardProps = {
  offer: OfferItem;
};

export function OfferCard({ offer }: OfferCardProps) {
  return (
    <article className={`offer-card${offer.isNew ? " is-highlighted" : ""}`}>
      <div className="offer-image-shell">
        {offer.imageUrl ? <img className="offer-image" src={offer.imageUrl} alt={offer.cardName} /> : <div className="image-fallback">R</div>}
      </div>

      <div className="offer-card-body">
        <div className="badge-row">
          <SourceBadge source={offer.source} />
          <LanguageBadge value={offer.languageNormalized} />
          <ConditionBadge value={offer.conditionNormalized} />
          {offer.isNew ? <NewOfferBadge /> : null}
        </div>

        <div>
          <h3>{offer.cardName}</h3>
          <p className="muted">
            {offer.setName ?? "Colecao nao identificada"} • {offer.year ?? "Ano n/d"}
          </p>
        </div>

        <div className="offer-meta-grid">
          <div>
            <span className="muted">Preco</span>
            <strong>{(offer.priceCents / 100).toFixed(2)} {offer.currency}</strong>
          </div>
          <div>
            <span className="muted">Loja / vendedor</span>
            <strong>{offer.storeName ?? offer.sellerName ?? "Nao informado"}</strong>
          </div>
          <div>
            <span className="muted">Pais</span>
            <strong>{offer.sellerCountry ?? "Nao informado"}</strong>
          </div>
          <div>
            <span className="muted">Primeira aparicao</span>
            <strong>{format(new Date(offer.firstSeenAt), "dd/MM/yyyy HH:mm")}</strong>
          </div>
        </div>

        <div className="offer-actions">
          <Link className="secondary-button" to={`/cards/${offer.cardId}`}>
            Ver card
          </Link>
          {offer.offerUrl ? (
            <a className="primary-button" href={offer.offerUrl} target="_blank" rel="noreferrer">
              Abrir anuncio original
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

