import type { NormalizedLanguage } from "../domain/offer.types";
import { normalizeText, safeTrim } from "./text-normalizer";

const languageMap: Array<{ patterns: string[]; normalized: NormalizedLanguage }> = [
  { patterns: ["portugues", "portuguese", "pt", "por"], normalized: "PORTUGUESE" },
  { patterns: ["ingles", "english", "en"], normalized: "ENGLISH" },
  { patterns: ["japones", "japanese", "jp"], normalized: "JAPANESE" },
  { patterns: ["espanhol", "spanish", "es"], normalized: "SPANISH" },
  { patterns: ["italiano", "italian", "it"], normalized: "ITALIAN" },
  { patterns: ["frances", "french", "fr"], normalized: "FRENCH" },
  { patterns: ["alemao", "german", "de"], normalized: "GERMAN" }
];

export function normalizeLanguage(value: string | null | undefined): {
  languageRaw: string | null;
  languageNormalized: NormalizedLanguage;
} {
  const languageRaw = safeTrim(value);
  const normalizedText = normalizeText(value);

  const match = languageMap.find((item) =>
    item.patterns.some((pattern) => normalizedText === pattern || normalizedText.includes(pattern))
  );

  return {
    languageRaw,
    languageNormalized: match?.normalized ?? "UNKNOWN"
  };
}

