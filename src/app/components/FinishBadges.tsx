type FinishBadgesProps = {
  tags: string[];
  raw?: string | null;
};

export function FinishBadges({ tags, raw }: FinishBadgesProps) {
  if (tags.length === 0) return <span className="muted" title={raw ?? undefined}>-</span>;

  return (
    <div className="finish-badge-row" title={raw ?? tags.join(", ")}>
      {tags.slice(0, 3).map((tag) => (
        <span className="badge finish-badge" key={tag}>
          {tag}
        </span>
      ))}
      {tags.length > 3 ? <span className="badge finish-badge">+{tags.length - 3}</span> : null}
    </div>
  );
}
