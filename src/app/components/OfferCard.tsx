import { format } from "date-fns";
import { Link } from "react-router-dom";
import { formatBrl, formatOriginalPrice, type OfferItem } from "../api/client";
import { ConditionBadge } from "./ConditionBadge";
import { FinishBadges } from "./FinishBadges";
import { LanguageBadge } from "./LanguageBadge";
import { NewOfferBadge } from "./NewOfferBadge";
import { SourceBadge } from "./SourceBadge";

type OfferCardProps = {
  offer: OfferItem;
};

export function OfferCard({ offer }: OfferCardProps) {
  const brl = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
  const orig = formatOriginalPrice(offer.priceCents, offer.currency);

  return (
    <article className={`offer-card${offer.isNew ? " is-highlighted" : ""}`}>
      <div className="offer-image-shell">
        {offer.imageUrl
          ? <img className="offer-image" src={offer.imageUrl} alt={offer.cardName} />
          : <div className="image-fallback">R</div>}
      </div>

      <div className="offer-card-body">
        <div className="badge-row">
          <SourceBadge source={offer.source} />
          <LanguageBadge value={offer.languageNormalized} />
          <ConditionBadge value={offer.conditionNormalized} />
          <FinishBadges tags={offer.finishTags} raw={offer.finishRaw} />
          {offer.isNew && <NewOfferBadge />}
        </div>

        <div>
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{offer.cardName}</p>
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            {offer.setName ?? "Coleção n/d"}{offer.year ? ` · ${offer.year}` : ""}
          </p>
        </div>

        <div className="offer-meta-grid">
          <div>
            <span className="muted">Preço</span>
            <strong className="price-brl">{brl}</strong>
            {orig && <span className="price-original">{orig}</span>}
          </div>
          <div>
            <span className="muted">Vendedor / Loja</span>
            <strong style={{ fontSize: "0.85rem" }}>{offer.storeName ?? offer.sellerName ?? "—"}</strong>
          </div>
          <div>
            <span className="muted">Primeira aparição</span>
            <strong style={{ fontSize: "0.82rem" }}>{format(new Date(offer.firstSeenAt), "dd/MM/yyyy HH:mm")}</strong>
          </div>
        </div>

        <div className="offer-actions">
          <Link className="btn btn-secondary btn-sm" to={`/cards/${offer.cardId}`}>
            Ver card
          </Link>
          {offer.offerUrl && (
            <a className="btn btn-primary btn-sm" href={offer.offerUrl} target="_blank" rel="noreferrer">
              Abrir anúncio ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
