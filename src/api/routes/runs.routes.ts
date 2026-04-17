import { Router } from "express";
import { RunRepository } from "../../db/repositories/run.repository";
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

  return router;
}
