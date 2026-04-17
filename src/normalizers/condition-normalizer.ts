import type { NormalizedCondition } from "../domain/offer.types";
import type { SourceKey } from "../domain/source.types";
import { normalizeText, safeTrim } from "./text-normalizer";

const conditionMap: Record<string, NormalizedCondition> = {
  mint: "M",
  m: "M",
  perfeito: "M",
  "near mint": "NM",
  nm: "NM",
  "quase novo": "NM",
  seminovo: "NM",
  "quase perfeito": "NM",
  excellent: "EX",
  ex: "EX",
  excelente: "EX",
  "slightly played": "SP",
  sp: "SP",
  "levemente jogado": "SP",
  "pouco usado": "SP",
  "moderately played": "MP",
  mp: "MP",
  "moderadamente jogado": "MP",
  "heavily played": "PL",
  hp: "PL",
  "muito jogado": "PL",
  played: "PL",
  pl: "PL",
  jogado: "PL",
  usado: "PL",
  poor: "PO",
  po: "PO",
  ruim: "PO",
  damaged: "PO",
  danificado: "PO",
  d: "PO"
};

export function normalizeCondition(
  _source: SourceKey,
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

  const direct = conditionMap[normalizedText];
  if (direct) {
    return { conditionRaw, conditionNormalized: direct };
  }

  for (const [key, normalized] of Object.entries(conditionMap)) {
    if (normalizedText.includes(key)) {
      return { conditionRaw, conditionNormalized: normalized };
    }
  }

  return { conditionRaw, conditionNormalized: "UNKNOWN" };
}
