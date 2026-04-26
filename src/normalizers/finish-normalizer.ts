import { normalizeText, safeTrim } from "./text-normalizer";

export const normalizedFinishes = [
  "NORMAL",
  "FOIL",
  "REVERSE_FOIL",
  "FULL_ART",
  "ALTERED_ART",
  "POKEBALL_FOIL",
  "MASTERBALL_FOIL",
  "PROMO",
  "UNLIMITED",
  "UNLIMITED_FOIL",
  "STAFF",
  "OVERSIZE",
  "UNKNOWN"
] as const;

export type NormalizedFinish = (typeof normalizedFinishes)[number];

type FinishExtraction = {
  finishRaw: string | null;
  finishTags: string[];
  finishNormalized: NormalizedFinish;
  variantLabel: string | null;
};

const finishLabels: Record<NormalizedFinish, string> = {
  NORMAL: "Normal",
  FOIL: "Foil",
  REVERSE_FOIL: "Reverse Foil",
  FULL_ART: "Full-Art",
  ALTERED_ART: "Altered Art",
  POKEBALL_FOIL: "Pokeball Foil",
  MASTERBALL_FOIL: "Masterball Foil",
  PROMO: "Promo",
  UNLIMITED: "Unlimited",
  UNLIMITED_FOIL: "Unlimited Foil",
  STAFF: "Staff",
  OVERSIZE: "Oversize",
  UNKNOWN: "Unknown"
};

function readString(value: unknown): string | null {
  return typeof value === "string" ? safeTrim(value) : null;
}

function pushUnique(values: string[], value: string | null): void {
  if (!value) return;
  if (!values.includes(value)) values.push(value);
}

function collectRawFinishValues(raw: unknown): string[] {
  const values: string[] = [];
  if (!raw || typeof raw !== "object") return values;

  const record = raw as Record<string, unknown>;
  pushUnique(values, readString(record.finishRaw));
  pushUnique(values, readString(record.finishText));
  pushUnique(values, readString(record.finish_normalized));
  pushUnique(values, readString(record.variantLabel));
  pushUnique(values, readString(record.variant_label));
  pushUnique(values, readString(record.descriptionText));

  const extra = record.extra;
  if (extra && typeof extra === "object") {
    const extraRecord = extra as Record<string, unknown>;
    pushUnique(values, readString(extraRecord.label));
    pushUnique(values, readString(extraRecord.acron));
  }

  return values;
}

export function labelForFinish(value: NormalizedFinish): string {
  return finishLabels[value];
}

export function normalizeFinish(
  value: string | null | undefined,
  options: { defaultNormal?: boolean } = {}
): FinishExtraction {
  const finishRaw = safeTrim(value);
  const normalized = normalizeText(value);

  if (!normalized) {
    if (options.defaultNormal) {
      return {
        finishRaw,
        finishTags: [finishLabels.NORMAL],
        finishNormalized: "NORMAL",
        variantLabel: finishLabels.NORMAL
      };
    }

    return {
      finishRaw,
      finishTags: [],
      finishNormalized: "UNKNOWN",
      variantLabel: null
    };
  }

  const match: NormalizedFinish =
    /\breverse\b|\brev\b|\brf\b|revers[ao]?\s*foil/.test(normalized)
      ? "REVERSE_FOIL"
      : /\bmaster ?ball\b|\bmasterball\b/.test(normalized)
        ? "MASTERBALL_FOIL"
        : /\bpoke ?ball\b|\bpokeball\b/.test(normalized)
          ? "POKEBALL_FOIL"
          : /\bunlimited\s+foil\b|\bfoil\s+unlimited\b/.test(normalized)
            ? "UNLIMITED_FOIL"
            : /\bfull.?art\b|\barte\s*completa\b|\bfullart\b/.test(normalized)
              ? "FULL_ART"
              : /\baltered.?art\b|\barte.?alternativa\b|\balternate.?art\b|\balt.?art\b/.test(normalized)
                ? "ALTERED_ART"
                : /\bstaff\b/.test(normalized)
                  ? "STAFF"
                  : /\bpromo\b|\bpromocional\b/.test(normalized)
                    ? "PROMO"
                    : /\boversize\b|\bjumbo\b|\bgigante\b/.test(normalized)
                      ? "OVERSIZE"
                      : /\bunlimited\b|ilimitad[ao]\b/.test(normalized)
                        ? "UNLIMITED"
                        : /\bfoil\b|\bholo\b|\bholographic\b|\bholografica\b|\bholografico\b/.test(normalized)
                          ? "FOIL"
                          : /\bnormal\b|\bregular\b|\bstandard\b|\bpadrao\b/.test(normalized)
                            ? "NORMAL"
                            : "UNKNOWN";

  const variantLabel = finishLabels[match];

  return {
    finishRaw,
    finishTags: match === "UNKNOWN" ? [] : [variantLabel],
    finishNormalized: match,
    variantLabel: match === "UNKNOWN" ? null : variantLabel
  };
}

export function extractOfferFinish(rawJson: string | null | undefined): FinishExtraction {
  if (!rawJson) {
    return { finishRaw: null, finishTags: [], finishNormalized: "UNKNOWN", variantLabel: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    return { finishRaw: null, finishTags: [], finishNormalized: "UNKNOWN", variantLabel: null };
  }

  const rawValues = collectRawFinishValues(parsed);
  const normalized = normalizeFinish(rawValues.join(" "));

  return {
    finishRaw: rawValues.length > 0 ? rawValues.join(" / ") : null,
    finishTags: normalized.finishTags,
    finishNormalized: normalized.finishNormalized,
    variantLabel: normalized.variantLabel
  };
}
