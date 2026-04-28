import { getDatabase } from "../database";

export type CardRecordInput = {
  source: string;
  sourceCardId: string | null;
  canonicalCardKey: string;
  name: string;
  setName: string | null;
  setCode: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  detailUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  rawHash: string;
  rawJson: string;
};

export type CardRecord = {
  id: number;
  source: string;
  source_card_id: string | null;
  canonical_card_key: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  year: number | null;
  number: string | null;
  rarity: string | null;
  image_url: string | null;
  detail_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  raw_hash: string | null;
  raw_json: string;
};

export type CardUpsertResult = {
  card: CardRecord;
  wasInserted: boolean;
};

export type CardListFilters = {
  source?: string;
  collection?: string;
  year?: number;
  query?: string;
  page: number;
  limit: number;
};

export type GroupedCardRecord = {
  id: number;
  name: string;
  set_name: string | null;
  set_code: string | null;
  year: number | null;
  number: string | null;
  image_url: string | null;
  sources: string;
  active_offer_count: number;
  min_price_cents: number | null;
  currency: string | null;
};

export class CardRepository {
  private readonly database = getDatabase();

  private buildWhereClause(filters: Omit<CardListFilters, "page" | "limit">): {
    whereSql: string;
    params: unknown[];
  } {
    const conditions = ["1 = 1"];
    const params: unknown[] = [];

    if (filters.source) {
      conditions.push("c.source = ?");
      params.push(filters.source);
    }

    if (filters.collection) {
      conditions.push("LOWER(COALESCE(c.set_name, '')) LIKE ?");
      params.push(`%${filters.collection.toLowerCase()}%`);
    }

    if (typeof filters.year === "number") {
      conditions.push("c.year = ?");
      params.push(filters.year);
    }

    if (filters.query) {
      conditions.push("LOWER(c.name) LIKE ?");
      params.push(`%${filters.query.toLowerCase()}%`);
    }

    return {
      whereSql: conditions.join(" AND "),
      params
    };
  }

  findById(id: number): CardRecord | undefined {
    return this.database
      .prepare("SELECT * FROM cards WHERE id = ?")
      .get(id) as CardRecord | undefined;
  }

  private findBySourceIdentity(input: Pick<CardRecordInput, "source" | "sourceCardId">): CardRecord | undefined {
    if (!input.sourceCardId) {
      return undefined;
    }

    return this.database
      .prepare("SELECT * FROM cards WHERE source = ? AND source_card_id = ?")
      .get(input.source, input.sourceCardId) as CardRecord | undefined;
  }

  private findByCanonicalKey(canonicalCardKey: string): CardRecord | undefined {
    return this.database
      .prepare("SELECT * FROM cards WHERE canonical_card_key = ?")
      .get(canonicalCardKey) as CardRecord | undefined;
  }

  findByIdentity(input: Pick<CardRecordInput, "source" | "sourceCardId" | "canonicalCardKey">): CardRecord | undefined {
    if (input.sourceCardId) {
      const existing = this.findBySourceIdentity(input);

      if (existing) {
        return existing;
      }
    }

    return this.findByCanonicalKey(input.canonicalCardKey);
  }

  upsert(input: CardRecordInput): CardUpsertResult {
    const existingByCanonical = this.findByCanonicalKey(input.canonicalCardKey);
    const existingBySource = this.findBySourceIdentity(input);
    const existing = existingByCanonical ?? existingBySource;

    if (existing) {
      const sourceCardIdConflicts =
        existingBySource && existingBySource.id !== existing.id;
      const canonicalKeyConflicts =
        existingByCanonical && existingByCanonical.id !== existing.id;

      this.database
        .prepare(
          `
            UPDATE cards
            SET
              source = @source,
              source_card_id = @sourceCardId,
              canonical_card_key = @canonicalCardKey,
              name = @name,
              set_name = @setName,
              set_code = @setCode,
              year = @year,
              number = @number,
              rarity = @rarity,
              image_url = @imageUrl,
              detail_url = @detailUrl,
              last_seen_at = @lastSeenAt,
              raw_hash = @rawHash,
              raw_json = @rawJson
            WHERE id = @id
          `
        )
        .run({
          ...input,
          sourceCardId: sourceCardIdConflicts ? existing.source_card_id : input.sourceCardId,
          canonicalCardKey: canonicalKeyConflicts ? existing.canonical_card_key : input.canonicalCardKey,
          id: existing.id
        });

      return {
        card: this.findById(existing.id)!,
        wasInserted: false
      };
    }

    const result = this.database
      .prepare(
        `
          INSERT INTO cards (
            source,
            source_card_id,
            canonical_card_key,
            name,
            set_name,
            set_code,
            year,
            number,
            rarity,
            image_url,
            detail_url,
            first_seen_at,
            last_seen_at,
            raw_hash,
            raw_json
          ) VALUES (
            @source,
            @sourceCardId,
            @canonicalCardKey,
            @name,
            @setName,
            @setCode,
            @year,
            @number,
            @rarity,
            @imageUrl,
            @detailUrl,
            @firstSeenAt,
            @lastSeenAt,
            @rawHash,
            @rawJson
          )
        `
      )
      .run(input);

    return {
      card: this.findById(Number(result.lastInsertRowid))!,
      wasInserted: true
    };
  }

  listGrouped(filters: CardListFilters): {
    items: GroupedCardRecord[];
    total: number;
    page: number;
    limit: number;
  } {
    const page = Math.max(filters.page, 1);
    const limit = Math.min(Math.max(filters.limit, 1), 100);
    const offset = (page - 1) * limit;
    const { whereSql, params } = this.buildWhereClause(filters);

    const totalRow = this.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM (
            SELECT 1
            FROM cards c
            WHERE ${whereSql}
            GROUP BY
              LOWER(c.name),
              LOWER(COALESCE(c.set_name, '')),
              COALESCE(c.year, -1),
              LOWER(COALESCE(c.number, ''))
          )
        `
      )
      .get(...params) as { count: number };

    const items = this.database
      .prepare(
        `
          SELECT
            MIN(c.id) AS id,
            MIN(c.name) AS name,
            MIN(c.set_name) AS set_name,
            MIN(c.set_code) AS set_code,
            MIN(c.year) AS year,
            MIN(c.number) AS number,
            MAX(c.image_url) AS image_url,
            GROUP_CONCAT(DISTINCT c.source) AS sources,
            COUNT(DISTINCT CASE WHEN o.is_active = 1 THEN o.id END) AS active_offer_count,
            MIN(CASE WHEN o.is_active = 1 THEN o.price_cents END) AS min_price_cents,
            MIN(CASE WHEN o.is_active = 1 THEN o.currency END) AS currency
          FROM cards c
          LEFT JOIN offers o ON o.card_id = c.id
          WHERE ${whereSql}
          GROUP BY
            LOWER(c.name),
            LOWER(COALESCE(c.set_name, '')),
            COALESCE(c.year, -1),
            LOWER(COALESCE(c.number, ''))
          ORDER BY MAX(c.last_seen_at) DESC, MIN(c.name) ASC
          LIMIT ? OFFSET ?
        `
      )
      .all(...params, limit, offset) as GroupedCardRecord[];

    return {
      items,
      total: totalRow.count,
      page,
      limit
    };
  }

  countGroupedCards(): number {
    const row = this.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM (
            SELECT 1
            FROM cards
            GROUP BY
              LOWER(name),
              LOWER(COALESCE(set_name, '')),
              COALESCE(year, -1),
              LOWER(COALESCE(number, ''))
          )
        `
      )
      .get() as { count: number };

    return row.count;
  }

  getGroupedCardById(id: number): GroupedCardRecord | undefined {
    const baseCard = this.findById(id);

    if (!baseCard) {
      return undefined;
    }

    return this.database
      .prepare(
        `
          SELECT
            MIN(c.id) AS id,
            MIN(c.name) AS name,
            MIN(c.set_name) AS set_name,
            MIN(c.set_code) AS set_code,
            MIN(c.year) AS year,
            MIN(c.number) AS number,
            MAX(c.image_url) AS image_url,
            GROUP_CONCAT(DISTINCT c.source) AS sources,
            COUNT(DISTINCT CASE WHEN o.is_active = 1 THEN o.id END) AS active_offer_count,
            MIN(CASE WHEN o.is_active = 1 THEN o.price_cents END) AS min_price_cents,
            MIN(CASE WHEN o.is_active = 1 THEN o.currency END) AS currency
          FROM cards c
          LEFT JOIN offers o ON o.card_id = c.id
          WHERE LOWER(c.name) = LOWER(?)
            AND COALESCE(LOWER(c.set_name), '') = ?
            AND COALESCE(c.year, -1) = ?
            AND COALESCE(LOWER(c.number), '') = ?
          GROUP BY
            LOWER(c.name),
            LOWER(COALESCE(c.set_name, '')),
            COALESCE(c.year, -1),
            LOWER(COALESCE(c.number, ''))
        `
      )
      .get(
        baseCard.name,
        (baseCard.set_name ?? "").toLowerCase(),
        baseCard.year ?? -1,
        (baseCard.number ?? "").toLowerCase()
      ) as GroupedCardRecord | undefined;
  }
}
