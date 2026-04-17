import { Router } from "express";
import { monitorStatusService } from "../../services/monitor-status.service";
import { monitorService } from "../../services/monitor.service";

export function createMonitorRouter(): Router {
  const router = Router();

  router.get("/monitor/status", (_req, res) => {
    res.json(monitorService.getStatus());
  });

  router.get("/monitor/events", (_req, res) => {
    const cleanup = monitorStatusService.subscribe(res);

    _req.on("close", cleanup);
    _req.on("end", cleanup);
  });

  router.post("/monitor/run", (_req, res) => {
    try {
      const status = monitorService.startManualMonitor();
      res.status(202).json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown monitor error";
      const statusCode = /already in progress/i.test(message) ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  return router;
}
