type SourceBadgeProps = {
  source: string;
};

export function SourceBadge({ source }: SourceBadgeProps) {
  if (source === "LIGA_POKEMON") {
    return <span className="badge badge-source-liga">Liga Pokemon</span>;
  }
  if (source === "CARDTRADER") {
    return <span className="badge badge-source-ct">CardTrader</span>;
  }
  return <span className="badge">{source}</span>;
}
