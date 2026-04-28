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
  if (source === "MYPCARDS") {
    return <span className="badge badge-source-myp">MYP Cards</span>;
  }
  return <span className="badge">{source}</span>;
}
