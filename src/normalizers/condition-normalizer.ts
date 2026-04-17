import type { NormalizedCondition } from "../domain/offer.types";
import type { SourceKey } from "../domain/source.types";
import { normalizeText, safeTrim } from "./text-normalizer";

const cardTraderMap: Record<string, NormalizedCondition> = {
  mint: "MINT",
  "near mint": "NEAR_MINT",
  nm: "NEAR_MINT",
  "slightly played": "SLIGHTLY_PLAYED",
  sp: "SLIGHTLY_PLAYED",
  "moderately played": "MODERATELY_PLAYED",
  mp: "MODERATELY_PLAYED",
  played: "PLAYED",
  "heavily played": "HEAVILY_PLAYED",
  hp: "HEAVILY_PLAYED",
  poor: "POOR"
};

const ligaPatterns: Array<{ patterns: string[]; normalized: NormalizedCondition }> = [
  { patterns: ["mint", "perfeito"], normalized: "MINT" },
  { patterns: ["near mint", "quase novo", "seminovo"], normalized: "NEAR_MINT" },
  { patterns: ["excellent", "excelente"], normalized: "EXCELLENT" },
  { patterns: ["slightly played", "levemente jogado", "pouco usado"], normalized: "SLIGHTLY_PLAYED" },
  { patterns: ["moderately played", "moderadamente jogado"], normalized: "MODERATELY_PLAYED" },
  { patterns: ["played", "jogado", "usado"], normalized: "PLAYED" },
  { patterns: ["heavily played", "muito jogado"], normalized: "HEAVILY_PLAYED" },
  { patterns: ["poor", "ruim"], normalized: "POOR" },
  { patterns: ["damaged", "danificado"], normalized: "DAMAGED" }
];

export function normalizeCondition(
  source: SourceKey,
  value: string | null | undefined
): {
  conditionRaw: string | null;
  conditionNormalized: NormalizedCondition;
} {
  const conditionRaw = safeTrim(value);
  const normalizedText = normalizeText(value);

  if (!normalizedText) {
    return { conditionRaw, conditionNormalized: "UNKNOWN" };
  }

  if (source === "CARDTRADER") {
    return {
      conditionRaw,
      conditionNormalized: cardTraderMap[normalizedText] ?? "UNKNOWN"
    };
  }

  const ligaMatch = ligaPatterns.find((item) =>
    item.patterns.some((pattern) => normalizedText === pattern || normalizedText.includes(pattern))
  );

  return {
    conditionRaw,
    conditionNormalized: ligaMatch?.normalized ?? "UNKNOWN"
  };
}

