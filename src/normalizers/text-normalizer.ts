export function safeTrim(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

const scrapeNoisePatterns = [
  /view all categories/i,
  /products from:\s*[$€£]/i,
  /shop optimizer/i,
  /it seems you are in brazil/i,
  /strictly necessary/i,
  /cookie/i
];

export function sanitizeScrapedLabel(
  value: string | null | undefined,
  maxLength = 160
): string | null {
  const trimmed = safeTrim(value);

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    return null;
  }

  if (scrapeNoisePatterns.some((pattern) => pattern.test(trimmed))) {
    return null;
  }

  return trimmed;
}

export function sanitizeImageUrl(value: string | null | undefined): string | null {
  const trimmed = safeTrim(value);

  if (!trimmed) {
    return null;
  }

  if (/\/assets\/logo/i.test(trimmed) || /logo_white/i.test(trimmed) || /logo_tcg/i.test(trimmed) || /loading/i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function normalizeText(value: string | null | undefined): string {
  const trimmed = safeTrim(value) ?? "";

  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function slugifyText(value: string | null | undefined): string {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "unknown";
  }

  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
