import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "../config/env";
import { runMigrations } from "../db/migrations";
import { monitorSchedulerService } from "../services/monitor-scheduler.service";
import { monitorService } from "../services/monitor.service";
import { createDashboardRouter } from "./routes/dashboard.routes";
import { createCardsRouter } from "./routes/cards.routes";
import { createMonitorRouter } from "./routes/monitor.routes";
import { createNotificationsRouter } from "./routes/notifications.routes";
import { createOffersRouter } from "./routes/offers.routes";
import { createPushRouter } from "./routes/push.routes";
import { createRunsRouter } from "./routes/runs.routes";
import { createSettingsRouter } from "./routes/settings.routes";

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
  const monitorStatus = monitorService.getStatus();
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    schedulerEnabled: monitorStatus.schedulerEnabled,
    isRunning: monitorStatus.isRunning,
    nextRunAt: monitorStatus.nextRunAt
  });
});

app.use("/api", createDashboardRouter());
app.use("/api", createCardsRouter());
app.use("/api", createMonitorRouter());
app.use("/api", createNotificationsRouter());
app.use("/api", createOffersRouter());
app.use("/api", createPushRouter());
app.use("/api", createRunsRouter());
app.use("/api", createSettingsRouter());

// Serve public/ assets (sw.js, manifest.json, icons) in dev mode.
// In production these are already inside dist/ via Vite build copy.
const publicDir = path.resolve(process.cwd(), "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

const clientDistPath = path.resolve(__dirname, "../../dist");
const clientIndexPath = path.join(clientDistPath, "index.html");

if (existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(clientIndexPath);
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  console.error("[api] unhandled error", error);
  res.status(500).json({ error: message });
});

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
  monitorSchedulerService.start();
});

function shutdown(): void {
  monitorSchedulerService.stop();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
