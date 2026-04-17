const conditionConfig: Record<string, { label: string; cls: string; title: string }> = {
  M: { label: "M", cls: "cond-M", title: "Mint" },
  NM: { label: "NM", cls: "cond-NM", title: "Near Mint" },
  EX: { label: "EX", cls: "cond-EX", title: "Excellent" },
  SP: { label: "SP", cls: "cond-SP", title: "Slightly Played" },
  MP: { label: "MP", cls: "cond-MP", title: "Moderately Played" },
  PL: { label: "PL", cls: "cond-PL", title: "Played / Heavily Played" },
  PO: { label: "PO", cls: "cond-PO", title: "Poor / Damaged" },
  UNKNOWN: { label: "?", cls: "cond-UNKNOWN", title: "Estado desconhecido" }
};

type ConditionBadgeProps = {
  value: string | null;
};

export function ConditionBadge({ value }: ConditionBadgeProps) {
  const normalized = value?.toUpperCase() ?? "UNKNOWN";
  const config = conditionConfig[normalized] ?? conditionConfig.UNKNOWN!;

  return (
    <span className={`badge ${config.cls}`} title={config.title}>
      {config.label}
    </span>
  );
}
