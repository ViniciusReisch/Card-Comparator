import { Link } from "react-router-dom";
import type { CardItem } from "../api/client";
import { SourceBadge } from "./SourceBadge";

type CardTileProps = {
  card: CardItem;
};

export function CardTile({ card }: CardTileProps) {
  return (
    <Link to={`/cards/${card.id}`} className="card-tile">
      <div className="card-media">
        {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : <div className="image-fallback">R</div>}
      </div>
      <div className="card-body">
        <div>
          <p className="eyebrow card-eyebrow">{card.setName ?? "Colecao nao identificada"}</p>
          <h3 className="card-title">{card.name}</h3>
          <p className="muted card-subtitle">
            {card.year ?? "Ano n/d"} {card.number ? `| #${card.number}` : ""}
          </p>
        </div>
        <div className="badge-row">
          {card.sources.map((source) => (
            <SourceBadge key={source} source={source} />
          ))}
        </div>
        <div className="card-metrics">
          <span>{card.activeOfferCount} ofertas ativas</span>
          <strong>
            {card.minPriceCents !== null ? `${(card.minPriceCents / 100).toFixed(2)} ${card.currency ?? ""}` : "Sem preco"}
          </strong>
        </div>
      </div>
    </Link>
  );
}
