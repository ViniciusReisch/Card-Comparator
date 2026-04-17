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

export class CardRepository {
  private readonly database = getDatabase();

  findById(id: number): CardRecord | undefined {
    return this.database
      .prepare("SELECT * FROM cards WHERE id = ?")
      .get(id) as CardRecord | undefined;
  }

  findByIdentity(input: Pick<CardRecordInput, "source" | "sourceCardId" | "canonicalCardKey">): CardRecord | undefined {
    if (input.sourceCardId) {
      const existing = this.database
        .prepare("SELECT * FROM cards WHERE source = ? AND source_card_id = ?")
        .get(input.source, input.sourceCardId) as CardRecord | undefined;

      if (existing) {
        return existing;
      }
    }

    return this.database
      .prepare("SELECT * FROM cards WHERE canonical_card_key = ?")
      .get(input.canonicalCardKey) as CardRecord | undefined;
  }

  upsert(input: CardRecordInput): CardRecord {
    const existing = this.findByIdentity(input);

    if (existing) {
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
          id: existing.id
        });

      return this.findById(existing.id)!;
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

    return this.findById(Number(result.lastInsertRowid))!;
  }
}

