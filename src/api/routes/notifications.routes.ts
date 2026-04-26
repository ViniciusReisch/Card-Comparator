import { Router } from "express";
import { notificationService } from "../../services/notification.service";

export function createNotificationsRouter(): Router {
  const router = Router();

  router.get("/notifications/status", (_req, res) => {
    res.json(notificationService.getStatus());
  });

  router.post("/notifications/test", async (_req, res) => {
    const results = await notificationService.sendTestNotification();
    res.json({
      status: results.some((result) => result.status === "sent") ? "sent" : "skipped",
      results
    });
  });

  return router;
}
