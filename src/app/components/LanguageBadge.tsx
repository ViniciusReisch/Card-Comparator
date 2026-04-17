const languageConfig: Record<string, { code: string; label: string }> = {
  PORTUGUESE: { code: "PT", label: "Portugues" },
  ENGLISH: { code: "EN", label: "English" },
  JAPANESE: { code: "JP", label: "Japanese" },
  SPANISH: { code: "ES", label: "Spanish" },
  FRENCH: { code: "FR", label: "French" },
  GERMAN: { code: "DE", label: "German" },
  ITALIAN: { code: "IT", label: "Italian" },
  KOREAN: { code: "KO", label: "Korean" },
  CHINESE_SIMPLIFIED: { code: "ZH", label: "Chinese Simplified" },
  CHINESE_TRADITIONAL: { code: "ZH-TW", label: "Chinese Traditional" },
  THAI: { code: "TH", label: "Thai" },
  INDONESIAN: { code: "ID", label: "Indonesian" },
  RUSSIAN: { code: "RU", label: "Russian" },
  DUTCH: { code: "NL", label: "Dutch" },
  UNKNOWN: { code: "?", label: "Desconhecido" }
};

type LanguageBadgeProps = {
  value: string | null;
  showLabel?: boolean;
};

export function LanguageBadge({ value, showLabel = false }: LanguageBadgeProps) {
  const normalized = value?.toUpperCase() ?? "UNKNOWN";
  const config = languageConfig[normalized] ?? languageConfig.UNKNOWN!;

  return (
    <span className="lang-badge" title={config.label}>
      {showLabel ? config.label : config.code}
    </span>
  );
}
