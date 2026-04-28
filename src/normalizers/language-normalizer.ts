import type { NormalizedLanguage } from "../domain/offer.types";
import { normalizeText, safeTrim } from "./text-normalizer";

const languageMap: Array<{ patterns: string[]; normalized: NormalizedLanguage }> = [
  {
    patterns: ["chinese simplified", "simplified chinese", "zh-cn", "zh cn", "zhcn", "chinese (s)", "chines simplificado", "simplificado", "简体中文"],
    normalized: "CHINESE_SIMPLIFIED"
  },
  {
    patterns: ["chinese traditional", "traditional chinese", "zh-tw", "zh tw", "zhtw", "chinese (t)", "chines tradicional", "tradicional", "繁體中文"],
    normalized: "CHINESE_TRADITIONAL"
  },
  {
    patterns: ["chinese", "zh", "chines"],
    normalized: "CHINESE_SIMPLIFIED"
  },
  { patterns: ["portuguese", "portugues", "pt", "por", "português", "pt-br", "br", "portugues brasileiro", "port"], normalized: "PORTUGUESE" },
  { patterns: ["english", "ingles", "en", "inglés", "inglese", "ingles americano", "ingles britanico", "eng"], normalized: "ENGLISH" },
  { patterns: ["japanese", "japones", "jp", "japonés", "日本語", "japonais", "jap", "japao"], normalized: "JAPANESE" },
  { patterns: ["spanish", "espanhol", "es", "español", "espagnol", "esp", "castellano"], normalized: "SPANISH" },
  { patterns: ["italian", "italiano", "it", "italians", "italienisch"], normalized: "ITALIAN" },
  { patterns: ["french", "frances", "fr", "français", "francés", "francese", "franzosisch", "francais", "fran"], normalized: "FRENCH" },
  { patterns: ["german", "alemao", "de", "deutsch", "alemão", "allemand", "tedesco", "alem"], normalized: "GERMAN" },
  { patterns: ["korean", "ko", "coreano", "한국어", "coreen", "cor"], normalized: "KOREAN" },
  { patterns: ["thai", "th", "tailandes", "tailandês", "ไทย", "tailand"], normalized: "THAI" },
  { patterns: ["indonesian", "indonesia", "id", "bahasa indonesia", "indonesio", "indonésio"], normalized: "INDONESIAN" },
  { patterns: ["russian", "ru", "russo", "русский", "russe"], normalized: "RUSSIAN" },
  { patterns: ["dutch", "nl", "holandes", "holandês", "nederlands", "neerlandais"], normalized: "DUTCH" }
];

export function normalizeLanguage(value: string | null | undefined): {
  languageRaw: string | null;
  languageNormalized: NormalizedLanguage;
} {
  const languageRaw = safeTrim(value);
  const normalizedText = normalizeText(value);

  const match = languageMap.find((item) =>
    item.patterns.some((pattern) => {
      if (pattern.length <= 3) return normalizedText === pattern;
      return normalizedText === pattern || normalizedText.includes(pattern);
    })
  );

  return {
    languageRaw,
    languageNormalized: match?.normalized ?? "UNKNOWN"
  };
}
