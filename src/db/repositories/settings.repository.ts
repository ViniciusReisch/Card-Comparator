import { getDatabase } from "../database";

export class SettingsRepository {
  private readonly database = getDatabase();

  get(key: string): string | null {
    const row = this.database
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;

    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.database
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (@key, @value, @updatedAt)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run({
        key,
        value,
        updatedAt: new Date().toISOString()
      });
  }

  setMany(values: Record<string, string>): void {
    const transaction = this.database.transaction((entries: Array<[string, string]>) => {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    });

    transaction(Object.entries(values));
  }
}
