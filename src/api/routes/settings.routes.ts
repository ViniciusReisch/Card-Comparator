import { Router } from "express";
import { ZodError } from "zod";
import { monitorSchedulerService } from "../../services/monitor-scheduler.service";
import { settingsService } from "../../services/settings.service";

export function createSettingsRouter(): Router {
  const router = Router();

  router.get("/settings", (_req, res) => {
    res.json(settingsService.getSettings());
  });

  router.put("/settings", (req, res) => {
    try {
      const settings = settingsService.updateSettings(req.body);
      monitorSchedulerService.configure({
        intervalMinutes: settings.monitor.intervalMinutes,
        schedulerEnabled: settings.monitor.schedulerEnabled
      });
      res.json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Invalid settings payload.",
          details: error.flatten()
        });
        return;
      }

      throw error;
    }
  });

  return router;
}
