import type { CardItem } from "../api/client";
import { CardTile } from "./CardTile";

type CardGridProps = {
  cards: CardItem[];
};

export function CardGrid({ cards }: CardGridProps) {
  return (
    <div className="card-grid">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}

