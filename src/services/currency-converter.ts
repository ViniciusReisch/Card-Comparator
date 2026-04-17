import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";

type RateCache = {
  date: string;
  rates: Record<string, number>;
  usedFallback: boolean;
};

type ConversionResult = {
  priceBrlCents: number;
  exchangeRate: number;
  exchangeRateDate: string;
  usedFallback: boolean;
};

const CACHE_PATH = path.resolve(process.cwd(), "storage/exchange-rate-cache.json");

const FALLBACK_RATES: Record<string, number> = {
  BRL: 1.0,
  EUR: 6.1,
  USD: 5.8,
  GBP: 7.3,
  JPY: 0.038,
  CHF: 6.5,
  AUD: 3.8,
  CAD: 4.2,
  SEK: 0.56,
  NOK: 0.54,
  DKK: 0.82,
  PLN: 1.42
};

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function fetchRatesFromApi(): Promise<Record<string, number> | null> {
  return new Promise((resolve) => {
    const url = "https://api.frankfurter.app/latest?from=USD";
    const req = https.get(url, { timeout: 10_000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk as string; });
      res.on("end", () => {
        try {
          const json = JSON.parse(body) as { rates: Record<string, number> };
          const usdToBrl = json.rates?.BRL;
          if (!usdToBrl) { resolve(null); return; }

          const rates: Record<string, number> = { BRL: 1.0, USD: usdToBrl };
          for (const [curr, usdRate] of Object.entries(json.rates)) {
            if (curr === "BRL" || !usdRate) { continue; }
            rates[curr] = usdToBrl / usdRate;
          }
          resolve(rates);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

class CurrencyConverter {
  private rates: Record<string, number> = { ...FALLBACK_RATES };
  private rateDate: string = getTodayDate();
  private initialized = false;
  private _usedFallback = true;

  get usedFallback(): boolean { return this._usedFallback; }

  async initialize(): Promise<void> {
    const today = getTodayDate();

    if (existsSync(CACHE_PATH)) {
      try {
        const cache = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as RateCache;
        if (cache.date === today && Object.keys(cache.rates).length > 1) {
          this.rates = { ...FALLBACK_RATES, ...cache.rates };
          this.rateDate = cache.date;
          this._usedFallback = cache.usedFallback ?? false;
          this.initialized = true;
          console.log(`[currency] cotacao do cache: USD→BRL ${this.rates.USD?.toFixed(2) ?? "?"} (${today})`);
          return;
        }
      } catch {
        // ignore
      }
    }

    console.log("[currency] buscando cotacao via Frankfurter API...");
    const fetched = await fetchRatesFromApi();

    if (fetched) {
      this.rates = { ...FALLBACK_RATES, ...fetched };
      this._usedFallback = false;
      console.log(`[currency] cotacao atualizada: EUR→BRL ${this.rates.EUR?.toFixed(2) ?? "?"}, USD→BRL ${this.rates.USD?.toFixed(2) ?? "?"}`);
    } else {
      this._usedFallback = true;
      console.warn("[currency] API falhou, usando taxas de fallback");
    }

    this.rateDate = today;
    this.initialized = true;

    try {
      mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      writeFileSync(CACHE_PATH, JSON.stringify({ date: today, rates: this.rates, usedFallback: this._usedFallback }, null, 2));
    } catch {
      // ignore cache write failures
    }
  }

  ensureInitialized(): void {
    if (!this.initialized) {
      this.initialized = true;
    }
  }

  convertToBrl(priceCents: number, currency: string): ConversionResult {
    this.ensureInitialized();
    const curr = currency?.toUpperCase() ?? "UNKNOWN";

    if (curr === "BRL") {
      return { priceBrlCents: priceCents, exchangeRate: 1.0, exchangeRateDate: this.rateDate, usedFallback: false };
    }

    const rate = this.rates[curr];
    if (!rate) {
      return { priceBrlCents: priceCents, exchangeRate: 1.0, exchangeRateDate: this.rateDate, usedFallback: true };
    }

    return {
      priceBrlCents: Math.round(priceCents * rate),
      exchangeRate: rate,
      exchangeRateDate: this.rateDate,
      usedFallback: this._usedFallback
    };
  }
}

export const currencyConverter = new CurrencyConverter();
