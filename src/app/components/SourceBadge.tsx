type SourceBadgeProps = {
  source: string;
};

export function SourceBadge({ source }: SourceBadgeProps) {
  const label = source === "LIGA_POKEMON" ? "Liga Pokemon" : "CardTrader";
  return <span className={`pill pill-${source.toLowerCase()}`}>{label}</span>;
}

