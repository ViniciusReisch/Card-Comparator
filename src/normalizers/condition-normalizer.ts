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
  danificada: "PO",
  dm: "PO",
  d: "PO"
};

const acronymMap: Record<string, NormalizedCondition> = {
  M: "M",
  NM: "NM",
  EX: "EX",
  SP: "SP",
  MP: "MP",
  HP: "PL",
  PL: "PL",
  PO: "PO",
  DM: "PO",
  D: "PO"
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

  const explicitAcronym = conditionRaw?.match(/\b(NM|SP|MP|HP|PL|PO|EX|DM|M|D)\b/i)?.[1]?.toUpperCase();
  if (explicitAcronym && acronymMap[explicitAcronym]) {
    return { conditionRaw, conditionNormalized: acronymMap[explicitAcronym] };
  }

  const direct = conditionMap[normalizedText];
  if (direct) {
    return { conditionRaw, conditionNormalized: direct };
  }

  // Sort longest keys first so "near mint" matches before "mint"
  const sortedEntries = Object.entries(conditionMap).sort(([a], [b]) => b.length - a.length);

  for (const [key, normalized] of sortedEntries) {
    const matches =
      key.length <= 2
        ? new RegExp(`\\b${key}\\b`).test(normalizedText)
        : normalizedText.includes(key);
    if (matches) {
      return { conditionRaw, conditionNormalized: normalized };
    }
  }

  return { conditionRaw, conditionNormalized: "UNKNOWN" };
}
