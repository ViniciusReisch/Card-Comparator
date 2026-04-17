import type { CardItem } from "../api/client";
import { CardTile } from "./CardTile";

type CardGridProps = {
  cards: CardItem[];
};

export function CardGrid({ cards }: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="notice" style={{ textAlign: "center", padding: "2rem" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🃏</p>
        <p>Nenhum card encontrado.</p>
      </div>
    );
  }

  return (
    <div className="cards-grid">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}

