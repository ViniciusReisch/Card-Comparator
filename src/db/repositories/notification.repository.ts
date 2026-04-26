import { getDatabase } from "../database";

export type NotificationProviderKey = "ntfy" | "telegram";
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export type NotificationDeliveryRecord = {
  id: number;
  run_id: number | null;
  offer_id: number | null;
  provider: NotificationProviderKey;
  destination: string | null;
  status: NotificationDeliveryStatus;
  error_message: string | null;
  payload_json: string | null;
  sent_at: string;
};

export class NotificationRepository {
  private readonly database = getDatabase();

  reserveDelivery(input: {
    runId: number | null;
    offerId: number | null;
    provider: NotificationProviderKey;
    destination: string | null;
    payload: unknown;
  }): NotificationDeliveryRecord | null {
    const sentAt = new Date().toISOString();
    const result = this.database
      .prepare(
        `INSERT OR IGNORE INTO notification_deliveries (
            run_id, offer_id, provider, destination, status, error_message, payload_json, sent_at
          ) VALUES (
            @runId, @offerId, @provider, @destination, 'pending', NULL, @payloadJson, @sentAt
          )`
      )
      .run({
        ...input,
        payloadJson: JSON.stringify(input.payload),
        sentAt
      });

    if (result.changes === 0) {
      return null;
    }

    return this.findById(Number(result.lastInsertRowid));
  }

  completeDelivery(input: {
    id: number;
    status: Exclude<NotificationDeliveryStatus, "pending">;
    errorMessage?: string | null;
  }): void {
    this.database
      .prepare(
        `UPDATE notification_deliveries
         SET status = @status, error_message = @errorMessage, sent_at = @sentAt
         WHERE id = @id`
      )
      .run({
        id: input.id,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        sentAt: new Date().toISOString()
      });
  }

  countSentByRun(runId: number | null | undefined): number {
    if (!runId) {
      return 0;
    }

    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM notification_deliveries WHERE run_id = ? AND status = 'sent'")
      .get(runId) as { count: number };

    return row.count;
  }

  countSentByRunByProvider(runId: number | null | undefined): Record<NotificationProviderKey, number> {
    const counts: Record<NotificationProviderKey, number> = {
      ntfy: 0,
      telegram: 0
    };

    if (!runId) {
      return counts;
    }

    const rows = this.database
      .prepare(
        `SELECT provider, COUNT(*) AS count
         FROM notification_deliveries
         WHERE run_id = ? AND status = 'sent'
         GROUP BY provider`
      )
      .all(runId) as Array<{ provider: NotificationProviderKey; count: number }>;

    for (const row of rows) {
      counts[row.provider] = row.count;
    }

    return counts;
  }

  private findById(id: number): NotificationDeliveryRecord {
    return this.database
      .prepare("SELECT * FROM notification_deliveries WHERE id = ?")
      .get(id) as NotificationDeliveryRecord;
  }
}
