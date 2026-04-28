const languageConfig: Record<string, { flag: string; code: string; label: string; cls: string }> = {
  PORTUGUESE: { flag: "\u{1F1E7}\u{1F1F7}", code: "PT", label: "Portugues", cls: "lang-pt" },
  ENGLISH: { flag: "\u{1F1FA}\u{1F1F8}", code: "EN", label: "English", cls: "lang-en" },
  JAPANESE: { flag: "\u{1F1EF}\u{1F1F5}", code: "JP", label: "Japones", cls: "lang-jp" },
  SPANISH: { flag: "\u{1F1EA}\u{1F1F8}", code: "ES", label: "Espanol", cls: "lang-es" },
  FRENCH: { flag: "\u{1F1EB}\u{1F1F7}", code: "FR", label: "Francais", cls: "lang-fr" },
  GERMAN: { flag: "\u{1F1E9}\u{1F1EA}", code: "DE", label: "Deutsch", cls: "lang-de" },
  ITALIAN: { flag: "\u{1F1EE}\u{1F1F9}", code: "IT", label: "Italiano", cls: "lang-it" },
  KOREAN: { flag: "\u{1F1F0}\u{1F1F7}", code: "KO", label: "Coreano", cls: "lang-ko" },
  CHINESE_SIMPLIFIED: { flag: "\u{1F1E8}\u{1F1F3}", code: "ZH", label: "Chines simpl.", cls: "lang-zh" },
  CHINESE_TRADITIONAL: { flag: "\u{1F1F9}\u{1F1FC}", code: "ZH-T", label: "Chines trad.", cls: "lang-zh" },
  THAI: { flag: "\u{1F1F9}\u{1F1ED}", code: "TH", label: "Tailandes", cls: "lang-th" },
  INDONESIAN: { flag: "\u{1F1EE}\u{1F1E9}", code: "ID", label: "Indonesio", cls: "lang-id" },
  RUSSIAN: { flag: "\u{1F1F7}\u{1F1FA}", code: "RU", label: "Russo", cls: "lang-ru" },
  DUTCH: { flag: "\u{1F1F3}\u{1F1F1}", code: "NL", label: "Nederlands", cls: "lang-nl" },
  UNKNOWN: { flag: "\u{1F310}", code: "?", label: "Desconhecido", cls: "lang-unk" }
};

type LanguageBadgeProps = {
  value: string | null;
  showLabel?: boolean;
};

export function LanguageBadge({ value, showLabel = false }: LanguageBadgeProps) {
  const normalized = value?.toUpperCase() ?? "UNKNOWN";
  const config = languageConfig[normalized] ?? languageConfig.UNKNOWN!;

  return (
    <span className={`lang-badge ${config.cls}`} title={config.label}>
      <span className="lang-flag">{config.flag}</span>
      {showLabel ? config.label : config.code}
    </span>
  );
}
