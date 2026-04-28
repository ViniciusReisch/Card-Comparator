import { getDatabase } from "../database";

export type PushSubscriptionRecord = {
  id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  user_agent: string | null;
  created_at: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keyP256dh: string;
  keyAuth: string;
  userAgent?: string | null;
};

export class PushSubscriptionRepository {
  private readonly db = getDatabase();

  upsert(input: PushSubscriptionInput): void {
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, user_agent, created_at)
         VALUES (@endpoint, @keyP256dh, @keyAuth, @userAgent, @createdAt)
         ON CONFLICT (endpoint) DO UPDATE SET
           keys_p256dh = @keyP256dh,
           keys_auth = @keyAuth,
           user_agent = @userAgent`
      )
      .run({
        endpoint: input.endpoint,
        keyP256dh: input.keyP256dh,
        keyAuth: input.keyAuth,
        userAgent: input.userAgent ?? null,
        createdAt: new Date().toISOString()
      });
  }

  delete(endpoint: string): void {
    this.db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
  }

  findAll(): PushSubscriptionRecord[] {
    return this.db.prepare("SELECT * FROM push_subscriptions").all() as PushSubscriptionRecord[];
  }

  count(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM push_subscriptions")
      .get() as { count: number };
    return row.count;
  }
}
