import webpush from "web-push";
import { env } from "../config/env";
import {
  NotificationRepository,
  type NotificationProviderKey
} from "../db/repositories/notification.repository";
import { PushSubscriptionRepository } from "../db/repositories/push-subscription.repository";
import type { RecentNewOfferSummary } from "../domain/monitor.types";
import { settingsService } from "./settings.service";

export type NotificationProviderStatus = {
  enabled: boolean;
  configured: boolean;
  destination: string | null;
};

export type NotificationStatusSnapshot = {
  ntfy: NotificationProviderStatus;
  telegram: NotificationProviderStatus;
};

export type NotificationSendResult = {
  provider: NotificationProviderKey;
  status: "sent" | "skipped" | "failed";
  message: string;
};

type NotificationPayload = {
  title: string;
  message: string;
  clickUrl: string | null;
  offer: RecentNewOfferSummary;
};

type NotificationProvider = {
  key: NotificationProviderKey;
  destination: string | null;
  enabled: boolean;
  configured: boolean;
  send(payload: NotificationPayload): Promise<void>;
};

function formatBrl(priceCents: number | null | undefined): string {
  if (priceCents == null) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(priceCents / 100);
}

function sourceLabel(source: string): string {
  if (source === "LIGA_POKEMON") return "Liga Pokemon";
  if (source === "CARDTRADER") return "CardTrader";
  if (source === "MYPCARDS") return "MYP Cards";
  return source;
}

type LanguagePresentation = {
  flag: string;
  label: string;
  code: string;
};

const languagePresentation: Record<string, LanguagePresentation> = {
  PORTUGUESE: { flag: "\u{1F1E7}\u{1F1F7}", label: "Portugues", code: "PT" },
  ENGLISH: { flag: "\u{1F1FA}\u{1F1F8}", label: "English", code: "EN" },
  JAPANESE: { flag: "\u{1F1EF}\u{1F1F5}", label: "Japones", code: "JP" },
  SPANISH: { flag: "\u{1F1EA}\u{1F1F8}", label: "Espanhol", code: "ES" },
  ITALIAN: { flag: "\u{1F1EE}\u{1F1F9}", label: "Italiano", code: "IT" },
  FRENCH: { flag: "\u{1F1EB}\u{1F1F7}", label: "Frances", code: "FR" },
  GERMAN: { flag: "\u{1F1E9}\u{1F1EA}", label: "Alemao", code: "DE" },
  KOREAN: { flag: "\u{1F1F0}\u{1F1F7}", label: "Coreano", code: "KO" },
  CHINESE_SIMPLIFIED: { flag: "\u{1F1E8}\u{1F1F3}", label: "Chines simplificado", code: "ZH" },
  CHINESE_TRADITIONAL: { flag: "\u{1F1F9}\u{1F1FC}", label: "Chines tradicional", code: "ZH-T" },
  THAI: { flag: "\u{1F1F9}\u{1F1ED}", label: "Tailandes", code: "TH" },
  INDONESIAN: { flag: "\u{1F1EE}\u{1F1E9}", label: "Indonesio", code: "ID" },
  RUSSIAN: { flag: "\u{1F1F7}\u{1F1FA}", label: "Russo", code: "RU" },
  DUTCH: { flag: "\u{1F1F3}\u{1F1F1}", label: "Holandes", code: "NL" },
  UNKNOWN: { flag: "\u{1F310}", label: "Idioma n/d", code: "?" }
};

const conditionPresentation: Record<string, string> = {
  M: "Mint",
  NM: "Near Mint",
  EX: "Excellent",
  SP: "Slightly Played",
  MP: "Moderately Played",
  PL: "Played",
  PO: "Poor",
  UNKNOWN: "Estado n/d"
};

const icon = {
  fire: "\u{1F525}",
  card: "\u{1F0CF}",
  money: "\u{1F4B0}",
  globe: "\u{1F310}",
  sparkles: "\u{2728}",
  condition: "\u{1F6E1}\u{FE0F}",
  box: "\u{1F4E6}",
  store: "\u{1F3EA}",
  pin: "\u{1F4CD}",
  source: "\u{1F50E}",
  link: "\u{1F517}",
  stack: "\u{1F522}",
  trend: "\u{1F4C8}"
};

function compactJoin(values: Array<string | null | undefined>, separator = " - "): string {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);
}

function formatCurrency(priceCents: number | null | undefined, currency: string | null | undefined): string {
  if (priceCents == null) return "-";
  const safeCurrency = currency || "BRL";

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: safeCurrency
    }).format(priceCents / 100);
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${safeCurrency}`;
  }
}

function formatLanguage(offer: RecentNewOfferSummary): string {
  const normalized = offer.languageNormalized?.toUpperCase() ?? "UNKNOWN";
  const presentation = languagePresentation[normalized] ?? languagePresentation.UNKNOWN!;
  const raw = offer.languageRaw?.trim();
  const rawSuffix = raw && ![presentation.code, presentation.label].includes(raw) ? ` (${raw})` : "";

  return `${presentation.flag} ${presentation.label}${rawSuffix}`;
}

function formatCondition(offer: RecentNewOfferSummary): string {
  const normalized = offer.conditionNormalized?.toUpperCase() ?? "UNKNOWN";
  const label = conditionPresentation[normalized] ?? normalized;
  const raw = offer.conditionRaw?.trim();
  const rawSuffix = raw && raw.toUpperCase() !== normalized ? ` (${raw})` : "";

  return `${label}${rawSuffix}`;
}

function formatCollection(offer: RecentNewOfferSummary): string {
  const setCode = offer.setCode ? `[${offer.setCode}]` : null;
  const number = offer.number ? `#${offer.number}` : null;
  const year = offer.year ? String(offer.year) : null;

  return compactJoin([offer.setName ?? "Colecao n/d", setCode, number, year]);
}

function formatExtras(offer: RecentNewOfferSummary): string {
  if (offer.finishTags.length > 0) {
    return offer.finishTags.join(", ");
  }

  return offer.finishRaw?.trim() || "Sem extra detectado";
}

function formatSeller(offer: RecentNewOfferSummary): string | null {
  const seller = compactJoin([offer.storeName, offer.sellerName], " / ");
  if (!seller) return null;
  return offer.sellerCountry ? `${seller} (${offer.sellerCountry})` : seller;
}

function buildOfferBody(offer: RecentNewOfferSummary, price: string, offerLink: string | null): string {
  const originalPrice =
    offer.currency !== "BRL"
      ? formatCurrency(offer.priceCents, offer.currency)
      : null;
  const seller = formatSeller(offer);
  const quantity = offer.quantity != null ? String(offer.quantity) : null;

  const details = [
    `${icon.card} ${offer.cardName}`,
    `${icon.money} Preco: ${price}${originalPrice ? ` (${originalPrice})` : ""}`,
    `${icon.globe} Idioma: ${formatLanguage(offer)}`,
    `${icon.sparkles} Extras: ${formatExtras(offer)}`,
    `${icon.condition} Estado: ${formatCondition(offer)}`,
    `${icon.box} Colecao: ${formatCollection(offer)}`,
    quantity ? `${icon.stack} Quantidade: ${quantity}` : null,
    seller ? `${icon.store} Vendedor: ${seller}` : null,
    `${icon.source} Fonte: ${sourceLabel(offer.source)}`,
    offerLink ? `${icon.link} Link: ${offerLink}` : null
  ].filter((line): line is string => Boolean(line));

  return details.join("\n");
}

function buildCompactOfferBody(offer: RecentNewOfferSummary, price: string): string {
  return [
    `${icon.money} ${price}`,
    `${icon.globe} ${formatLanguage(offer)}`,
    `${icon.sparkles} ${formatExtras(offer)}`,
    `${icon.source} ${sourceLabel(offer.source)}`
  ].join("\n");
}

function buildNtfyTags(offer: RecentNewOfferSummary): string {
  const tags = ["shopping_cart", "card_index"];
  if (offer.finishTags.length > 0 || offer.finishRaw) tags.push("sparkles");
  if (offer.languageNormalized === "PORTUGUESE") tags.push("flag_br");
  if (offer.languageNormalized === "ENGLISH") tags.push("flag_us");
  if (offer.languageNormalized === "JAPANESE") tags.push("flag_jp");
  return tags.join(",");
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function toHeaderValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 120);
}

function toHeaderUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const sanitized = value.replace(/[^\x20-\x7E]/g, "").trim();
  return /^https?:\/\//i.test(sanitized) ? sanitized : null;
}

function createNtfyProvider(): NotificationProvider {
  const settings = settingsService.getNotificationProviderSettings().ntfy;
  const topic = settings.topic.trim();
  const baseUrl = normalizeBaseUrl(settings.baseUrl);

  return {
    key: "ntfy",
    enabled: settings.enabled,
    configured: topic.length > 0,
    destination: topic || null,
    async send(payload) {
      const imageUrl = toHeaderUrl(payload.offer.imageUrl);
      const response = await fetch(`${baseUrl}/${encodeURIComponent(topic)}`, {
        method: "POST",
        body: payload.message,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Title: toHeaderValue(payload.title),
          Priority: toHeaderValue(settings.priority),
          Tags: buildNtfyTags(payload.offer),
          ...(imageUrl ? { Icon: imageUrl, Attach: imageUrl } : {}),
          ...(payload.clickUrl ? { Click: payload.clickUrl } : {})
        }
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`ntfy returned ${response.status}${body ? `: ${body}` : ""}`);
      }
    }
  };
}

function createTelegramProvider(): NotificationProvider {
  const settings = settingsService.getNotificationProviderSettings().telegram;
  const botToken = settings.botToken.trim();
  const chatId = settings.chatId.trim();

  return {
    key: "telegram",
    enabled: settings.enabled,
    configured: botToken.length > 0 && chatId.length > 0,
    destination: chatId || null,
    async send(payload) {
      if (payload.offer.imageUrl) {
        const photoResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            photo: payload.offer.imageUrl,
            caption: `${payload.title}\n\n${payload.message}`.slice(0, 1024)
          })
        });

        if (photoResponse.ok) {
          return;
        }
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: `${payload.title}\n\n${payload.message}`,
          disable_web_page_preview: false
        })
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram returned ${response.status}${body ? `: ${body}` : ""}`);
      }
    }
  };
}

export class NotificationService {
  private readonly repository = new NotificationRepository();
  private readonly pushRepository = new PushSubscriptionRepository();

  getStatus(): NotificationStatusSnapshot {
    const ntfy = createNtfyProvider();
    const telegram = createTelegramProvider();

    return {
      ntfy: {
        enabled: ntfy.enabled,
        configured: ntfy.configured,
        destination: ntfy.destination
      },
      telegram: {
        enabled: telegram.enabled,
        configured: telegram.configured,
        destination: telegram.destination
      }
    };
  }

  countSentByRun(runId: number | null | undefined): number {
    return this.repository.countSentByRun(runId);
  }

  countSentByRunByProvider(runId: number | null | undefined): Record<NotificationProviderKey, number> {
    return this.repository.countSentByRunByProvider(runId);
  }

  async notifyNewOffer(offer: RecentNewOfferSummary, runId: number): Promise<NotificationSendResult[]> {
    const payload = this.buildOfferPayload(offer);
    const results: NotificationSendResult[] = [];

    for (const provider of this.getProviders()) {
      const result = await this.sendWithProvider(provider, payload, {
        runId,
        offerId: offer.id,
        shouldReserve: true
      });
      results.push(result);
    }

    void this.sendWebPush({
      title: `${icon.fire} Novo anuncio: ${offer.cardName}`,
      body: buildCompactOfferBody(
        offer,
        formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null))
      ),
      url: offer.offerUrl ?? this.getAppUrl() ?? null,
      tag: `offer-${offer.id}`,
      imageUrl: offer.imageUrl
    });

    return results;
  }

  async sendTestNotification(): Promise<NotificationSendResult[]> {
    const testOffer: RecentNewOfferSummary = {
      id: 0,
      cardId: 0,
      source: "LIGA_POKEMON",
      cardName: "Rayquaza Monitor",
      setName: "Teste de notificacao",
      setCode: null,
      year: null,
      number: null,
      languageRaw: "PT",
      languageNormalized: "PORTUGUESE",
      conditionRaw: "NM",
      conditionNormalized: "NM",
      finishRaw: "Reverse Foil",
      finishNormalized: "REVERSE_FOIL",
      variantLabel: "Reverse Foil",
      finishTags: ["Reverse Foil"],
      priceCents: 12345,
      currency: "BRL",
      priceBrlCents: 12345,
      exchangeRateToBrl: 1,
      exchangeRateDate: new Date().toISOString().slice(0, 10),
      imageUrl: null,
      offerUrl: this.getAppUrl(),
      sellerName: null,
      sellerCountry: null,
      storeName: "Teste",
      quantity: 1,
      isNew: true,
      isActive: true,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      lastPriceCents: null,
      firstSeenRunId: null
    };

    const payload = this.buildOfferPayload(testOffer, `${icon.fire} Teste de notificacao Rayquaza`);
    const results: NotificationSendResult[] = [];

    for (const provider of this.getProviders()) {
      const result = await this.sendWithProvider(provider, payload, {
        runId: null,
        offerId: null,
        shouldReserve: false
      });
      results.push(result);
    }

    void this.sendWebPush({
      title: `${icon.fire} Teste de notificacao Rayquaza`,
      body: buildCompactOfferBody(testOffer, "R$ 123,45"),
      url: this.getAppUrl() || null,
      tag: "test",
      imageUrl: null
    });

    return results;
  }

  async sendWebPush(payload: { title: string; body: string; url: string | null; tag?: string; imageUrl?: string | null }): Promise<void> {
    const subscriptions = this.pushRepository.findAll();
    if (subscriptions.length === 0) return;

    const { publicKey, privateKey } = settingsService.getVapidKeys();
    webpush.setVapidDetails("mailto:rayquaza@monitor.local", publicKey, privateKey);

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag ?? "rayquaza",
      icon: "/notification-icon-192.png",
      image: payload.imageUrl ?? null
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            body
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "unknown";
          console.warn(`[push] failed for endpoint ${sub.endpoint.slice(0, 40)}…: ${msg}`);
          if (msg.includes("410") || msg.includes("404")) {
            this.pushRepository.delete(sub.endpoint);
          }
        }
      })
    );
  }

  private getProviders(): NotificationProvider[] {
    return [createNtfyProvider(), createTelegramProvider()];
  }

  private async sendWithProvider(
    provider: NotificationProvider,
    payload: NotificationPayload,
    input: {
      runId: number | null;
      offerId: number | null;
      shouldReserve: boolean;
    }
  ): Promise<NotificationSendResult> {
    if (!provider.enabled) {
      return {
        provider: provider.key,
        status: "skipped",
        message: "Provider disabled."
      };
    }

    if (!provider.configured) {
      return {
        provider: provider.key,
        status: "skipped",
        message: "Provider enabled but not configured."
      };
    }

    const delivery = input.shouldReserve
      ? this.repository.reserveDelivery({
          runId: input.runId,
          offerId: input.offerId,
          provider: provider.key,
          destination: provider.destination,
          payload
        })
      : null;

    if (input.shouldReserve && !delivery) {
      return {
        provider: provider.key,
        status: "skipped",
        message: "Notification already reserved for this offer and run."
      };
    }

    try {
      await provider.send(payload);

      if (delivery) {
        this.repository.completeDelivery({
          id: delivery.id,
          status: "sent"
        });
      }

      return {
        provider: provider.key,
        status: "sent",
        message: "Notification sent."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown notification error";

      if (delivery) {
        this.repository.completeDelivery({
          id: delivery.id,
          status: "failed",
          errorMessage: message
        });
      }

      console.error(`[notifications] ${provider.key} failed`, message);

      return {
        provider: provider.key,
        status: "failed",
        message
      };
    }
  }

  private buildOfferPayload(offer: RecentNewOfferSummary, title = `${icon.fire} Novo anuncio: ${offer.cardName}`): NotificationPayload {
    const price = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
    const appUrl = this.getAppUrl();
    const offerLink = offer.offerUrl ?? (appUrl ? `${appUrl}/cards/${offer.cardId}` : null);

    return {
      title,
      message: buildOfferBody(offer, price, offerLink),
      clickUrl: offerLink,
      offer
    };
  }

  private getAppUrl(): string {
    return (env.APP_PUBLIC_URL || env.API_PUBLIC_URL || "").replace(/\/+$/, "");
  }
}

export const notificationService = new NotificationService();
