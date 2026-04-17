type ConditionBadgeProps = {
  value: string | null;
};

export function ConditionBadge({ value }: ConditionBadgeProps) {
  return <span className="pill pill-neutral">{value ?? "UNKNOWN"}</span>;
}

