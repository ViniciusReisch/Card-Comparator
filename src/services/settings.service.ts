import webpush from "web-push";
import { z } from "zod";
import { env } from "../config/env";
import { SettingsRepository } from "../db/repositories/settings.repository";

export type AppSettingsSnapshot = {
  monitor: {
    intervalMinutes: number;
    schedulerEnabled: boolean;
  };
  notifications: {
    ntfy: {
      enabled: boolean;
      baseUrl: string;
      topic: string;
      priority: string;
    };
    telegram: {
      enabled: boolean;
      botTokenConfigured: boolean;
      chatId: string;
    };
  };
};

export type AppSettingsUpdate = {
  monitor?: {
    intervalMinutes?: number;
    schedulerEnabled?: boolean;
  };
  notifications?: {
    ntfy?: {
      enabled?: boolean;
      baseUrl?: string;
      topic?: string;
      priority?: string;
    };
    telegram?: {
      enabled?: boolean;
      botToken?: string;
      chatId?: string;
    };
  };
};

const settingsUpdateSchema = z.object({
  monitor: z
    .object({
      intervalMinutes: z.coerce.number().int().min(1).max(1440).optional(),
      schedulerEnabled: z.boolean().optional()
    })
    .optional(),
  notifications: z
    .object({
      ntfy: z
        .object({
          enabled: z.boolean().optional(),
          baseUrl: z.string().url().optional(),
          topic: z.string().max(160).optional(),
          priority: z.enum(["min", "low", "default", "high", "urgent", "1", "2", "3", "4", "5"]).optional()
        })
        .optional(),
      telegram: z
        .object({
          enabled: z.boolean().optional(),
          botToken: z.string().max(300).optional(),
          chatId: z.string().max(120).optional()
        })
        .optional()
    })
    .optional()
});

function boolToString(value: boolean): string {
  return value ? "true" : "false";
}

function stringToBool(value: string | null, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }

  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

function numberFromSetting(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

export class SettingsService {
  private readonly repository = new SettingsRepository();

  getSettings(): AppSettingsSnapshot {
    const telegramToken = this.get("notifications.telegram.botToken", env.TELEGRAM_BOT_TOKEN);

    return {
      monitor: {
        intervalMinutes: numberFromSetting(this.get("monitor.intervalMinutes", null), env.MONITOR_INTERVAL_MINUTES),
        schedulerEnabled: stringToBool(this.get("monitor.schedulerEnabled", null), env.ENABLE_BACKGROUND_SCHEDULER)
      },
      notifications: {
        ntfy: {
          enabled: stringToBool(this.get("notifications.ntfy.enabled", null), env.NTFY_ENABLED),
          baseUrl: this.get("notifications.ntfy.baseUrl", env.NTFY_BASE_URL),
          topic: this.get("notifications.ntfy.topic", env.NTFY_TOPIC),
          priority: this.get("notifications.ntfy.priority", env.NTFY_PRIORITY)
        },
        telegram: {
          enabled: stringToBool(this.get("notifications.telegram.enabled", null), env.TELEGRAM_ENABLED),
          botTokenConfigured: telegramToken.trim().length > 0,
          chatId: this.get("notifications.telegram.chatId", env.TELEGRAM_CHAT_ID)
        }
      }
    };
  }

  getMonitorIntervalMinutes(): number {
    return this.getSettings().monitor.intervalMinutes;
  }

  getSchedulerEnabled(): boolean {
    return this.getSettings().monitor.schedulerEnabled;
  }

  getNotificationProviderSettings() {
    const settings = this.getSettings();
    return {
      ntfy: settings.notifications.ntfy,
      telegram: {
        enabled: settings.notifications.telegram.enabled,
        botToken: this.get("notifications.telegram.botToken", env.TELEGRAM_BOT_TOKEN),
        chatId: settings.notifications.telegram.chatId
      }
    };
  }

  updateSettings(input: unknown): AppSettingsSnapshot {
    const parsed = settingsUpdateSchema.parse(input);
    const values: Record<string, string> = {};

    if (parsed.monitor?.intervalMinutes !== undefined) {
      values["monitor.intervalMinutes"] = String(parsed.monitor.intervalMinutes);
    }
    if (parsed.monitor?.schedulerEnabled !== undefined) {
      values["monitor.schedulerEnabled"] = boolToString(parsed.monitor.schedulerEnabled);
    }

    if (parsed.notifications?.ntfy?.enabled !== undefined) {
      values["notifications.ntfy.enabled"] = boolToString(parsed.notifications.ntfy.enabled);
    }
    if (parsed.notifications?.ntfy?.baseUrl !== undefined) {
      values["notifications.ntfy.baseUrl"] = parsed.notifications.ntfy.baseUrl.trim();
    }
    if (parsed.notifications?.ntfy?.topic !== undefined) {
      values["notifications.ntfy.topic"] = parsed.notifications.ntfy.topic.trim();
    }
    if (parsed.notifications?.ntfy?.priority !== undefined) {
      values["notifications.ntfy.priority"] = parsed.notifications.ntfy.priority;
    }

    if (parsed.notifications?.telegram?.enabled !== undefined) {
      values["notifications.telegram.enabled"] = boolToString(parsed.notifications.telegram.enabled);
    }
    if (parsed.notifications?.telegram?.botToken !== undefined && parsed.notifications.telegram.botToken.trim().length > 0) {
      values["notifications.telegram.botToken"] = parsed.notifications.telegram.botToken.trim();
    }
    if (parsed.notifications?.telegram?.chatId !== undefined) {
      values["notifications.telegram.chatId"] = parsed.notifications.telegram.chatId.trim();
    }

    this.repository.setMany(values);
    return this.getSettings();
  }

  setSchedulerEnabled(enabled: boolean): void {
    this.repository.set("monitor.schedulerEnabled", boolToString(enabled));
  }

  getVapidKeys(): { publicKey: string; privateKey: string } {
    const publicKey = this.get("vapid.publicKey", null);
    const privateKey = this.get("vapid.privateKey", null);

    if (publicKey && privateKey) {
      return { publicKey, privateKey };
    }

    const keys = webpush.generateVAPIDKeys();
    this.repository.setMany({
      "vapid.publicKey": keys.publicKey,
      "vapid.privateKey": keys.privateKey
    });
    return keys;
  }

  private get(key: string, fallback: string | null): string {
    return this.repository.get(key) ?? fallback ?? "";
  }
}

export const settingsService = new SettingsService();
