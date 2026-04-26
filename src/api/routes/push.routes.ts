import { Router } from "express";
import { PushSubscriptionRepository } from "../../db/repositories/push-subscription.repository";
import { settingsService } from "../../services/settings.service";

const pushSubscriptionRepository = new PushSubscriptionRepository();

export function createPushRouter(): Router {
  const router = Router();

  router.get("/push/vapid-public-key", (_req, res) => {
    const { publicKey } = settingsService.getVapidKeys();
    res.json({ publicKey });
  });

  router.post("/push/subscribe", (req, res) => {
    const body = req.body as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    };

    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : null;
    const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : null;
    const auth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : null;

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: "endpoint, keys.p256dh and keys.auth are required." });
      return;
    }

    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
    pushSubscriptionRepository.upsert({ endpoint, keyP256dh: p256dh, keyAuth: auth, userAgent });
    res.json({ status: "subscribed" });
  });

  router.post("/push/unsubscribe", (req, res) => {
    const body = req.body as { endpoint?: unknown };
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : null;

    if (!endpoint) {
      res.status(400).json({ error: "endpoint is required." });
      return;
    }

    pushSubscriptionRepository.delete(endpoint);
    res.json({ status: "unsubscribed" });
  });

  router.get("/push/subscription-count", (_req, res) => {
    res.json({ count: pushSubscriptionRepository.count() });
  });

  return router;
}
