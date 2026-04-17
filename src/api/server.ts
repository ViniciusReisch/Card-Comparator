import express from "express";
import { env } from "../config/env";
import { runMigrations } from "../db/migrations";
import { createDashboardRouter } from "./routes/dashboard.routes";
import { createCardsRouter } from "./routes/cards.routes";
import { createMonitorRouter } from "./routes/monitor.routes";
import { createOffersRouter } from "./routes/offers.routes";
import { createRunsRouter } from "./routes/runs.routes";

const app = express();
runMigrations();

app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", createDashboardRouter());
app.use("/api", createCardsRouter());
app.use("/api", createMonitorRouter());
app.use("/api", createOffersRouter());
app.use("/api", createRunsRouter());

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  console.error("[api] unhandled error", error);
  res.status(500).json({ error: message });
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
