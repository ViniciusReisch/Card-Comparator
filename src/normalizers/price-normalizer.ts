import { safeTrim } from "./text-normalizer";

function inferCurrency(value: string): string {
  if (value.includes("R$")) {
    return "BRL";
  }

  if (value.includes("€")) {
    return "EUR";
  }

  if (value.includes("$")) {
    return "USD";
  }

  return "UNKNOWN";
}

export function normalizePrice(value: string | number | null | undefined): {
  priceCents: number;
  currency: string;
} {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { priceCents: Math.round(value * 100), currency: "UNKNOWN" };
  }

  const raw = safeTrim(typeof value === "string" ? value : null) ?? "";
  const currency = inferCurrency(raw);
  const numeric = raw.replace(/[^\d,.-]/g, "");
  const normalized = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric;
  const parsed = Number.parseFloat(normalized);

  return {
    priceCents: Number.isFinite(parsed) ? Math.round(parsed * 100) : 0,
    currency
  };
}

