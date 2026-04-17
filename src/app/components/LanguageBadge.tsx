const langConfig: Record<string, { flag: string; code: string; label: string }> = {
  PORTUGUESE:           { flag: "🇧🇷", code: "PT",    label: "Português" },
  ENGLISH:              { flag: "🇺🇸", code: "EN",    label: "English" },
  JAPANESE:             { flag: "🇯🇵", code: "JP",    label: "日本語" },
  SPANISH:              { flag: "🇪🇸", code: "ES",    label: "Español" },
  FRENCH:               { flag: "🇫🇷", code: "FR",    label: "Français" },
  GERMAN:               { flag: "🇩🇪", code: "DE",    label: "Deutsch" },
  ITALIAN:              { flag: "🇮🇹", code: "IT",    label: "Italiano" },
  KOREAN:               { flag: "🇰🇷", code: "KO",    label: "한국어" },
  CHINESE_SIMPLIFIED:   { flag: "🇨🇳", code: "ZH",    label: "简体中文" },
  CHINESE_TRADITIONAL:  { flag: "🇹🇼", code: "ZH-TW", label: "繁體中文" },
  THAI:                 { flag: "🇹🇭", code: "TH",    label: "ภาษาไทย" },
  INDONESIAN:           { flag: "🇮🇩", code: "ID",    label: "Bahasa" },
  RUSSIAN:              { flag: "🇷🇺", code: "RU",    label: "Русский" },
  DUTCH:                { flag: "🇳🇱", code: "NL",    label: "Nederlands" }
};

type LanguageBadgeProps = {
  value: string | null;
  showLabel?: boolean;
};

export function LanguageBadge({ value, showLabel = false }: LanguageBadgeProps) {
  const normalized = value?.toUpperCase() ?? "UNKNOWN";
  const config = langConfig[normalized];

  if (!config) {
    return (
      <span className="lang-badge" title={value ?? "Unknown"}>
        <span className="flag">🌐</span>
        {value ?? "?"}
      </span>
    );
  }

  return (
    <span className="lang-badge" title={config.label}>
      <span className="flag">{config.flag}</span>
      {showLabel ? config.label : config.code}
    </span>
  );
}
