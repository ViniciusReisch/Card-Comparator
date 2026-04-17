PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_card_id TEXT,
  canonical_card_key TEXT NOT NULL,
  name TEXT NOT NULL,
  set_name TEXT,
  set_code TEXT,
  year INTEGER,
  number TEXT,
  rarity TEXT,
  image_url TEXT,
  detail_url TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  raw_hash TEXT,
  raw_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_source_source_card_id
  ON cards (source, source_card_id)
  WHERE source_card_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_canonical_card_key
  ON cards (canonical_card_key);

CREATE INDEX IF NOT EXISTS idx_cards_display_fields
  ON cards (name, set_name, year, number);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_offer_id TEXT,
  canonical_offer_key TEXT NOT NULL,
  card_name TEXT NOT NULL,
  set_name TEXT,
  set_code TEXT,
  year INTEGER,
  language_raw TEXT,
  language_normalized TEXT,
  condition_raw TEXT,
  condition_normalized TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  image_url TEXT,
  offer_url TEXT,
  seller_name TEXT,
  seller_country TEXT,
  store_name TEXT,
  quantity INTEGER,
  is_new INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_price_cents INTEGER,
  missing_count INTEGER NOT NULL DEFAULT 0,
  raw_hash TEXT,
  raw_json TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_source_source_offer_id
  ON offers (source, source_offer_id)
  WHERE source_offer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_canonical_offer_key
  ON offers (canonical_offer_key);

CREATE INDEX IF NOT EXISTS idx_offers_card_id
  ON offers (card_id);

CREATE INDEX IF NOT EXISTS idx_offers_active_new
  ON offers (is_active, is_new, source);

CREATE INDEX IF NOT EXISTS idx_offers_first_seen_at
  ON offers (first_seen_at DESC);

CREATE TABLE IF NOT EXISTS monitor_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  total_cards_found INTEGER NOT NULL DEFAULT 0,
  total_offers_found INTEGER NOT NULL DEFAULT 0,
  new_offers_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitor_runs_started_at
  ON monitor_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS monitor_run_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  cards_found INTEGER NOT NULL DEFAULT 0,
  offers_found INTEGER NOT NULL DEFAULT 0,
  new_offers_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (run_id) REFERENCES monitor_runs (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitor_run_sources_run_id
  ON monitor_run_sources (run_id);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  FOREIGN KEY (offer_id) REFERENCES offers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_offer_id
  ON price_history (offer_id, seen_at DESC);

