import { readFileSync } from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { getDatabase } from "./database";

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // column already exists
  }
}

function backfillBrlPrices(db: Database): void {
  const today = new Date().toISOString().slice(0, 10);
  const fallbackRates: Record<string, number> = {
    BRL: 1.0, EUR: 6.1, USD: 5.8, GBP: 7.3, JPY: 0.038,
    CHF: 6.5, AUD: 3.8, CAD: 4.2, SEK: 0.56, NOK: 0.54, PLN: 1.42
  };

  for (const [currency, rate] of Object.entries(fallbackRates)) {
    if (currency === "BRL") {
      db.prepare(`
        UPDATE offers SET
          original_price_cents = price_cents,
          original_currency = currency,
          price_brl_cents = price_cents,
          exchange_rate_to_brl = 1.0,
          exchange_rate_date = ?
        WHERE currency = ? AND price_brl_cents IS NULL
      `).run(today, currency);
    } else {
      db.prepare(`
        UPDATE offers SET
          original_price_cents = price_cents,
          original_currency = currency,
          price_brl_cents = ROUND(price_cents * ?),
          exchange_rate_to_brl = ?,
          exchange_rate_date = ?
        WHERE currency = ? AND price_brl_cents IS NULL
      `).run(rate, rate, today, currency);
    }
  }
}

function applyDataMigrations(db: Database): void {
  const conditionMap: Record<string, string> = {
    NEAR_MINT: "NM",
    SLIGHTLY_PLAYED: "SP",
    MODERATELY_PLAYED: "MP",
    HEAVILY_PLAYED: "PL",
    PLAYED: "PL",
    POOR: "PO",
    DAMAGED: "PO",
    MINT: "M",
    EXCELLENT: "EX"
  };

  for (const [oldCode, newCode] of Object.entries(conditionMap)) {
    db.prepare("UPDATE offers SET condition_normalized = ? WHERE condition_normalized = ?").run(newCode, oldCode);
  }

  // Fix language normalization bug: short pattern "en" matched "french" → ENGLISH
  // Re-normalize based on raw text for affected languages
  const conditionRawFixes: Array<{ rawPattern: string; normalized: string }> = [
    { rawPattern: "%(NM)%", normalized: "NM" },
    { rawPattern: "%praticamente nova%", normalized: "NM" },
    { rawPattern: "%(SP)%", normalized: "SP" },
    { rawPattern: "%usada levemente%", normalized: "SP" },
    { rawPattern: "%(MP)%", normalized: "MP" },
    { rawPattern: "%usada moderadamente%", normalized: "MP" },
    { rawPattern: "%(HP)%", normalized: "PL" },
    { rawPattern: "%(PL)%", normalized: "PL" },
    { rawPattern: "%muito usada%", normalized: "PL" },
    { rawPattern: "%(PO)%", normalized: "PO" },
    { rawPattern: "%danificada%", normalized: "PO" },
    { rawPattern: "%(M)%", normalized: "M" },
    { rawPattern: "%nova (m)%", normalized: "M" }
  ];

  for (const { rawPattern, normalized } of conditionRawFixes) {
    db.prepare("UPDATE offers SET condition_normalized = ? WHERE condition_raw IS NOT NULL AND LOWER(condition_raw) LIKE ?")
      .run(normalized, rawPattern);
  }

  const languageRawFixes: Array<{ rawPattern: string; correctNormalized: string; wrongNormalized: string }> = [
    { rawPattern: "%french%",     correctNormalized: "FRENCH",   wrongNormalized: "ENGLISH" },
    { rawPattern: "%français%",   correctNormalized: "FRENCH",   wrongNormalized: "ENGLISH" },
    { rawPattern: "%francais%",   correctNormalized: "FRENCH",   wrongNormalized: "ENGLISH" },
    { rawPattern: "%frances%",    correctNormalized: "FRENCH",   wrongNormalized: "ENGLISH" },
    { rawPattern: "%francês%",    correctNormalized: "FRENCH",   wrongNormalized: "ENGLISH" },
  ];

  for (const { rawPattern, correctNormalized, wrongNormalized } of languageRawFixes) {
    db.prepare(
      "UPDATE offers SET language_normalized = ? WHERE language_normalized = ? AND LOWER(language_raw) LIKE ?"
    ).run(correctNormalized, wrongNormalized, rawPattern);
  }

  db.prepare(`
    DELETE FROM cards
    WHERE source = 'LIGA_POKEMON'
      AND (
        detail_url LIKE '%view=cards/search%'
        OR name LIKE 'edid=%'
      )
  `).run();
}

export function runMigrations(): void {
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf8");
  const database = getDatabase();

  database.exec(schemaSql);

  // Add new columns to offers (for existing databases)
  addColumnIfMissing(database, "offers", "original_price_cents", "INTEGER");
  addColumnIfMissing(database, "offers", "original_currency", "TEXT");
  addColumnIfMissing(database, "offers", "price_brl_cents", "INTEGER");
  addColumnIfMissing(database, "offers", "exchange_rate_to_brl", "REAL");
  addColumnIfMissing(database, "offers", "exchange_rate_date", "TEXT");
  addColumnIfMissing(database, "offers", "first_seen_run_id", "INTEGER");
  addColumnIfMissing(database, "offers", "finish_raw", "TEXT");
  addColumnIfMissing(database, "offers", "finish_normalized", "TEXT");
  addColumnIfMissing(database, "offers", "variant_label", "TEXT");

  addColumnIfMissing(database, "monitor_runs", "progress_snapshot_json", "TEXT");
  addColumnIfMissing(database, "monitor_runs", "duration_ms", "INTEGER");
  addColumnIfMissing(database, "monitor_runs", "estimated_total_cards", "INTEGER");
  addColumnIfMissing(database, "monitor_runs", "processed_cards", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(database, "monitor_runs", "total_sources_done", "INTEGER NOT NULL DEFAULT 0");

  addColumnIfMissing(database, "notification_deliveries", "payload_json", "TEXT");

  // Add new columns to price_history
  addColumnIfMissing(database, "price_history", "price_brl_cents", "INTEGER");
  addColumnIfMissing(database, "price_history", "exchange_rate_to_brl", "REAL");

  applyDataMigrations(database);
  backfillBrlPrices(database);
}
