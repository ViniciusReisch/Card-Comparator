import { Router } from "express";
import { RunRepository } from "../../db/repositories/run.repository";
import { monitorService } from "../../services/monitor.service";
import { mapRun } from "./route-helpers";

export function createRunsRouter(): Router {
  const router = Router();
  const runRepository = new RunRepository();

  router.get("/runs", (_req, res) => {
    const runs = runRepository.listRuns(100);

    res.json({
      items: runs.map((run) => mapRun(run, runRepository.listSourceRuns(run.id)))
    });
  });

  router.post("/monitor/run", async (_req, res) => {
    try {
      const summary = await monitorService.runManualMonitor();
      res.status(202).json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown monitor error";
      const statusCode = /already in progress/i.test(message) ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  return router;
}

