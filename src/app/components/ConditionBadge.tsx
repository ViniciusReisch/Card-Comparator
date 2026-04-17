const condConfig: Record<string, { label: string; icon: string; cls: string; title: string }> = {
  M:       { label: "M",  icon: "✦", cls: "cond-M",       title: "Mint — Perfeito" },
  NM:      { label: "NM", icon: "✓", cls: "cond-NM",      title: "Near Mint — Quase perfeito" },
  EX:      { label: "EX", icon: "★", cls: "cond-EX",      title: "Excellent — Excelente" },
  SP:      { label: "SP", icon: "◐", cls: "cond-SP",      title: "Slightly Played — Levemente jogado" },
  MP:      { label: "MP", icon: "⚠", cls: "cond-MP",      title: "Moderately Played — Moderadamente jogado" },
  PL:      { label: "PL", icon: "▲", cls: "cond-PL",      title: "Played / Heavily Played — Jogado" },
  PO:      { label: "PO", icon: "✕", cls: "cond-PO",      title: "Poor / Damaged — Danificado" },
  UNKNOWN: { label: "?",  icon: "?", cls: "cond-UNKNOWN",  title: "Estado desconhecido" }
};

type ConditionBadgeProps = {
  value: string | null;
};

export function ConditionBadge({ value }: ConditionBadgeProps) {
  const normalized = value?.toUpperCase() ?? "UNKNOWN";
  const config = condConfig[normalized] ?? condConfig["UNKNOWN"]!;

  return (
    <span className={`badge ${config.cls}`} title={config.title}>
      <span style={{ fontSize: "0.65rem" }}>{config.icon}</span>
      {config.label}
    </span>
  );
}
