type LanguageBadgeProps = {
  value: string | null;
};

export function LanguageBadge({ value }: LanguageBadgeProps) {
  return <span className="pill pill-language">{value ?? "UNKNOWN"}</span>;
}

