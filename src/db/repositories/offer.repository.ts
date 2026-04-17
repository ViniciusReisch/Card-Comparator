import { getDatabase } from "../database";

export type OfferRecordInput = {
  cardId: number;
  source: string;
  sourceOfferId: string | null;
  canonicalOfferKey: string;
  cardName: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  languageRaw: string | null;
  languageNormalized: string | null;
  conditionRaw: string | null;
  conditionNormalized: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  offerUrl: string | null;
  sellerName: string | null;
  sellerCountry: string | null;
  storeName: string | null;
  quantity: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  rawHash: string;
  rawJson: string;
};

export type OfferRecord = {
  id: number;
  card_id: number;
  source: string;
  source_offer_id: string | null;
  canonical_offer_key: string;
  card_name: string;
  set_name: string | null;
  set_code: string | null;
  year: number | null;
  language_raw: string | null;
  language_normalized: string | null;
  condition_raw: string | null;
  condition_normalized: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  offer_url: string | null;
  seller_name: string | null;
  seller_country: string | null;
  store_name: string | null;
  quantity: number | null;
  is_new: number;
  is_active: number;
  first_seen_at: string;
  last_seen_at: string;
  last_price_cents: number | null;
  missing_count: number;
  raw_hash: string | null;
  raw_json: string;
};

export type OfferUpsertResult = {
  offer: OfferRecord;
  wasInserted: boolean;
  priceChanged: boolean;
};

export type OfferListFilters = {
  source?: string;
  language?: string;
  condition?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  collection?: string;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  onlyNew?: boolean;
  onlyActive?: boolean;
  cardGroup?: {
    name: string;
    setName: string | null;
    year: number | null;
    number: string | null;
  };
  page: number;
  limit: number;
};

export type OfferListRecord = OfferRecord & {
  card_number: string | null;
  card_image_url: string | null;
  origin_card_id: number;
};

export class OfferRepository {
  private readonly database = getDatabase();

  private buildWhereClause(filters: Omit<OfferListFilters, "page" | "limit">): {
    whereSql: string;
    params: unknown[];
  } {
    const conditions = ["1 = 1"];
    const params: unknown[] = [];

    if (filters.source) {
      conditions.push("o.source = ?");
      params.push(filters.source);
    }

    if (filters.language) {
      conditions.push("o.language_normalized = ?");
      params.push(filters.language);
    }

    if (filters.condition) {
      conditions.push("o.condition_normalized = ?");
      params.push(filters.condition);
    }

    if (typeof filters.minPriceCents === "number") {
      conditions.push("o.price_cents >= ?");
      params.push(filters.minPriceCents);
    }

    if (typeof filters.maxPriceCents === "number") {
      conditions.push("o.price_cents <= ?");
      params.push(filters.maxPriceCents);
    }

    if (filters.collection) {
      conditions.push("LOWER(COALESCE(o.set_name, '')) LIKE ?");
      params.push(`%${filters.collection.toLowerCase()}%`);
    }

    if (typeof filters.year === "number") {
      conditions.push("o.year = ?");
      params.push(filters.year);
    }

    if (filters.dateFrom) {
      conditions.push("o.first_seen_at >= ?");
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push("o.first_seen_at <= ?");
      params.push(filters.dateTo);
    }

    if (filters.onlyNew) {
      conditions.push("o.is_new = 1");
    }

    if (filters.onlyActive !== false) {
      conditions.push("o.is_active = 1");
    }

    if (filters.cardGroup) {
      conditions.push("LOWER(o.card_name) = LOWER(?)");
      params.push(filters.cardGroup.name);
      conditions.push("COALESCE(LOWER(o.set_name), '') = ?");
      params.push((filters.cardGroup.setName ?? "").toLowerCase());
      conditions.push("COALESCE(o.year, -1) = ?");
      params.push(filters.cardGroup.year ?? -1);
      conditions.push("COALESCE(LOWER(c.number), '') = ?");
      params.push((filters.cardGroup.number ?? "").toLowerCase());
    }

    return {
      whereSql: conditions.join(" AND "),
      params
    };
  }

  resetNewFlags(): void {
    this.database.prepare("UPDATE offers SET is_new = 0").run();
  }

  private findById(id: number): OfferRecord | undefined {
    return this.database
      .prepare("SELECT * FROM offers WHERE id = ?")
      .get(id) as OfferRecord | undefined;
  }

  private findByIdentity(
    input: Pick<OfferRecordInput, "source" | "sourceOfferId" | "canonicalOfferKey">
  ): OfferRecord | undefined {
    if (input.sourceOfferId) {
      const existing = this.database
        .prepare("SELECT * FROM offers WHERE source = ? AND source_offer_id = ?")
        .get(input.source, input.sourceOfferId) as OfferRecord | undefined;

      if (existing) {
        return existing;
      }
    }

    return this.database
      .prepare("SELECT * FROM offers WHERE canonical_offer_key = ?")
      .get(input.canonicalOfferKey) as OfferRecord | undefined;
  }

  private addPriceHistory(offerId: number, priceCents: number, currency: string, seenAt: string): void {
    this.database
      .prepare(
        `
          INSERT INTO price_history (offer_id, price_cents, currency, seen_at)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(offerId, priceCents, currency, seenAt);
  }

  upsert(input: OfferRecordInput): OfferUpsertResult {
    const existing = this.findByIdentity(input);

    if (!existing) {
      const result = this.database
        .prepare(
          `
            INSERT INTO offers (
              card_id,
              source,
              source_offer_id,
              canonical_offer_key,
              card_name,
              set_name,
              set_code,
              year,
              language_raw,
              language_normalized,
              condition_raw,
              condition_normalized,
              price_cents,
              currency,
              image_url,
              offer_url,
              seller_name,
              seller_country,
              store_name,
              quantity,
              is_new,
              is_active,
              first_seen_at,
              last_seen_at,
              last_price_cents,
              missing_count,
              raw_hash,
              raw_json
            ) VALUES (
              @cardId,
              @source,
              @sourceOfferId,
              @canonicalOfferKey,
              @cardName,
              @setName,
              @setCode,
              @year,
              @languageRaw,
              @languageNormalized,
              @conditionRaw,
              @conditionNormalized,
              @priceCents,
              @currency,
              @imageUrl,
              @offerUrl,
              @sellerName,
              @sellerCountry,
              @storeName,
              @quantity,
              1,
              1,
              @firstSeenAt,
              @lastSeenAt,
              @priceCents,
              0,
              @rawHash,
              @rawJson
            )
          `
        )
        .run(input);

      const offer = this.findById(Number(result.lastInsertRowid))!;
      this.addPriceHistory(offer.id, offer.price_cents, offer.currency, offer.first_seen_at);
      return { offer, wasInserted: true, priceChanged: false };
    }

    const priceChanged = existing.price_cents !== input.priceCents || existing.currency !== input.currency;

    this.database
      .prepare(
        `
          UPDATE offers
          SET
            card_id = @cardId,
            source = @source,
            source_offer_id = @sourceOfferId,
            canonical_offer_key = @canonicalOfferKey,
            card_name = @cardName,
            set_name = @setName,
            set_code = @setCode,
            year = @year,
            language_raw = @languageRaw,
            language_normalized = @languageNormalized,
            condition_raw = @conditionRaw,
            condition_normalized = @conditionNormalized,
            price_cents = @priceCents,
            currency = @currency,
            image_url = @imageUrl,
            offer_url = @offerUrl,
            seller_name = @sellerName,
            seller_country = @sellerCountry,
            store_name = @storeName,
            quantity = @quantity,
            is_new = 0,
            is_active = 1,
            last_seen_at = @lastSeenAt,
            last_price_cents = @lastPriceCents,
            missing_count = 0,
            raw_hash = @rawHash,
            raw_json = @rawJson
          WHERE id = @id
        `
      )
      .run({
        ...input,
        id: existing.id,
        lastPriceCents: priceChanged ? existing.price_cents : existing.last_price_cents
      });

    if (priceChanged) {
      this.addPriceHistory(existing.id, input.priceCents, input.currency, input.lastSeenAt);
    }

    return {
      offer: this.findById(existing.id)!,
      wasInserted: false,
      priceChanged
    };
  }

  reconcileMissingOffers(source: string, seenOfferIds: number[]): void {
    if (seenOfferIds.length === 0) {
      this.database
        .prepare(
          `
            UPDATE offers
            SET
              missing_count = missing_count + 1,
              is_active = CASE WHEN missing_count + 1 >= 3 THEN 0 ELSE 1 END
            WHERE source = ? AND is_active = 1
          `
        )
        .run(source);
      return;
    }

    const placeholders = seenOfferIds.map(() => "?").join(", ");
    const statement = this.database.prepare(
      `
        UPDATE offers
        SET
          missing_count = missing_count + 1,
          is_active = CASE WHEN missing_count + 1 >= 3 THEN 0 ELSE 1 END
        WHERE source = ?
          AND is_active = 1
          AND id NOT IN (${placeholders})
      `
    );

    statement.run(source, ...seenOfferIds);
  }

  listOffers(filters: OfferListFilters): {
    items: OfferListRecord[];
    total: number;
    page: number;
    limit: number;
  } {
    const page = Math.max(filters.page, 1);
    const limit = Math.min(Math.max(filters.limit, 1), 200);
    const offset = (page - 1) * limit;
    const { whereSql, params } = this.buildWhereClause(filters);

    const totalRow = this.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM offers o
          INNER JOIN cards c ON c.id = o.card_id
          WHERE ${whereSql}
        `
      )
      .get(...params) as { count: number };

    const items = this.database
      .prepare(
        `
          SELECT
            o.*,
            c.number AS card_number,
            c.image_url AS card_image_url,
            c.id AS origin_card_id
          FROM offers o
          INNER JOIN cards c ON c.id = o.card_id
          WHERE ${whereSql}
          ORDER BY o.first_seen_at DESC, o.price_cents ASC, o.id DESC
          LIMIT ? OFFSET ?
        `
      )
      .all(...params, limit, offset) as OfferListRecord[];

    return {
      items,
      total: totalRow.count,
      page,
      limit
    };
  }

  countActiveOffers(): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM offers WHERE is_active = 1")
      .get() as { count: number };

    return row.count;
  }

  countNewOffers(): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM offers WHERE is_new = 1")
      .get() as { count: number };

    return row.count;
  }

  getLowestActiveOffer(): OfferListRecord | undefined {
    return this.database
      .prepare(
        `
          SELECT
            o.*,
            c.number AS card_number,
            c.image_url AS card_image_url,
            c.id AS origin_card_id
          FROM offers o
          INNER JOIN cards c ON c.id = o.card_id
          WHERE o.is_active = 1
          ORDER BY o.price_cents ASC, o.id ASC
          LIMIT 1
        `
      )
      .get() as OfferListRecord | undefined;
  }

  listLatestNewOffers(limit = 10): OfferListRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            o.*,
            c.number AS card_number,
            c.image_url AS card_image_url,
            c.id AS origin_card_id
          FROM offers o
          INNER JOIN cards c ON c.id = o.card_id
          WHERE o.is_new = 1
          ORDER BY o.first_seen_at DESC, o.id DESC
          LIMIT ?
        `
      )
      .all(limit) as OfferListRecord[];
  }
}
