import { Link } from "react-router-dom";
import { formatBrl, type CardItem } from "../api/client";
import { SourceBadge } from "./SourceBadge";

type CardTileProps = {
  card: CardItem;
};

export function CardTile({ card }: CardTileProps) {
  const priceDisplay = card.minPriceCents != null ? formatBrl(card.minPriceCents) : null;

  return (
    <Link to={`/cards/${card.id}`} className="card-tile">
      {card.imageUrl ? (
        <img className="card-tile-img" src={card.imageUrl} alt={card.name} />
      ) : (
        <div className="card-tile-img-fallback">R</div>
      )}
      <div className="card-tile-body">
        <p className="card-tile-set">{card.setName ?? "Colecao n/d"}</p>
        <p className="card-tile-name">{card.name}</p>
        <p className="card-tile-meta">
          {card.year ?? "-"}
          {card.number ? ` · #${card.number}` : ""}
        </p>
        <div className="badge-row" style={{ marginTop: "0.25rem" }}>
          {card.sources.map((source) => (
            <SourceBadge key={source} source={source} />
          ))}
        </div>
        <div className="card-tile-footer">
          <span className="card-tile-count">
            {card.activeOfferCount} oferta{card.activeOfferCount !== 1 ? "s" : ""}
          </span>
          {priceDisplay ? <span className="card-tile-price">{priceDisplay}</span> : null}
        </div>
      </div>
    </Link>
  );
}
