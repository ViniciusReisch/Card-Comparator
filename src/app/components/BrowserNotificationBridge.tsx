import { useRef } from "react";
import { apiBaseUrl, formatBrl, type OfferItem } from "../api/client";
import { useMonitorStatus } from "../hooks/useMonitorStatus";

export const BROWSER_NOTIFICATIONS_STORAGE_KEY = "rayquaza.browserNotificationsEnabled";
export const WEB_PUSH_SUBSCRIBED_KEY = "rayquaza.webPushSubscribed";

function browserNotificationsEnabled(): boolean {
  return window.localStorage.getItem(BROWSER_NOTIFICATIONS_STORAGE_KEY) === "true";
}

function sourceLabel(source: string): string {
  if (source === "LIGA_POKEMON") return "Liga Pokemon";
  if (source === "CARDTRADER") return "CardTrader";
  if (source === "MYPCARDS") return "MYP Cards";
  return source;
}

const languagePresentation: Record<string, { flag: string; label: string; code: string }> = {
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

const icon = {
  fire: "\u{1F525}",
  money: "\u{1F4B0}",
  globe: "\u{1F310}",
  sparkles: "\u{2728}",
  source: "\u{1F50E}"
};

function formatLanguage(offer: OfferItem): string {
  const normalized = offer.languageNormalized?.toUpperCase() ?? "UNKNOWN";
  const presentation = languagePresentation[normalized] ?? languagePresentation.UNKNOWN!;
  const raw = offer.languageRaw?.trim();
  const rawSuffix = raw && ![presentation.code, presentation.label].includes(raw) ? ` (${raw})` : "";

  return `${presentation.flag} ${presentation.label}${rawSuffix}`;
}

function formatExtras(offer: OfferItem): string {
  if (offer.finishTags.length > 0) return offer.finishTags.join(", ");
  return offer.finishRaw?.trim() || "Sem extra detectado";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function showInPageNotification(offer: OfferItem): void {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted" || !browserNotificationsEnabled()) return;

  const price = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
  const options: NotificationOptions & { image?: string } = {
    body: [
      `${icon.money} ${price}`,
      `${icon.globe} ${formatLanguage(offer)}`,
      `${icon.sparkles} ${formatExtras(offer)}`,
      `${icon.source} ${sourceLabel(offer.source)}`
    ].join("\n"),
    tag: `offer-${offer.id}`,
    icon: offer.imageUrl ?? "/icon-192.png",
    image: offer.imageUrl ?? undefined
  };
  const notification = new Notification(`${icon.fire} Novo anuncio: ${offer.cardName}`, options);

  notification.onclick = () => {
    window.focus();
    if (offer.offerUrl) window.open(offer.offerUrl, "_blank", "noopener,noreferrer");
  };
}

export async function registerWebPush(): Promise<"subscribed" | "permission-denied" | "unsupported" | "error"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  if (!window.isSecureContext) return "unsupported";

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") return "permission-denied";

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const vapidRes = await fetch(`${apiBaseUrl}/api/push/vapid-public-key`);
    const { publicKey } = await vapidRes.json() as { publicKey: string };

    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
    });

    await fetch(`${apiBaseUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });

    window.localStorage.setItem(WEB_PUSH_SUBSCRIBED_KEY, "true");
    return "subscribed";
  } catch {
    return "error";
  }
}

export async function unregisterWebPush(): Promise<void> {
  window.localStorage.removeItem(WEB_PUSH_SUBSCRIBED_KEY);

  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await fetch(`${apiBaseUrl}/api/push/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      await subscription.unsubscribe();
    }
  } catch {
    // ignore
  }
}

export function BrowserNotificationBridge() {
  const notifiedOfferIdsRef = useRef(new Set<number>());

  useMonitorStatus({
    onNewOffer: (offer) => {
      if (notifiedOfferIdsRef.current.has(offer.id)) return;
      notifiedOfferIdsRef.current.add(offer.id);
      showInPageNotification(offer);
    }
  });

  return null;
}
