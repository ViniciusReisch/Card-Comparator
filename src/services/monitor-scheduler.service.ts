import { env } from "../config/env";
import { monitorService } from "./monitor.service";
import { monitorStatusService } from "./monitor-status.service";

export class MonitorSchedulerService {
  private readonly intervalMs = env.MONITOR_INTERVAL_MINUTES * 60 * 1000;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private enabled = env.ENABLE_BACKGROUND_SCHEDULER;
  private nextRunAt: string | null = null;

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    monitorStatusService.updateScheduler({
      schedulerEnabled: this.enabled,
      nextRunAt: null
    });

    if (!this.enabled) {
      console.log("[scheduler] background scheduler disabled");
      return;
    }

    if (env.RUN_ON_BOOT) {
      console.log("[scheduler] background scheduler enabled; first run starts now");
      this.scheduleNextRun(0);
      return;
    }

    console.log(`[scheduler] background scheduler enabled; interval ${env.MONITOR_INTERVAL_MINUTES} minute(s)`);
    this.scheduleNextRun(this.intervalMs);
  }

  pause() {
    this.enabled = false;
    this.clearTimer();
    this.nextRunAt = null;
    console.log("[scheduler] paused");

    return monitorStatusService.updateScheduler({
      schedulerEnabled: false,
      nextRunAt: null
    });
  }

  resume() {
    this.enabled = true;
    console.log(`[scheduler] resumed; next run in ${env.MONITOR_INTERVAL_MINUTES} minute(s)`);
    this.scheduleNextRun(this.intervalMs);

    return monitorStatusService.getStatus();
  }

  stop(): void {
    this.clearTimer();
  }

  private scheduleNextRun(delayMs: number): void {
    if (!this.enabled) {
      return;
    }

    this.clearTimer();
    const safeDelayMs = Math.max(0, delayMs);
    this.nextRunAt = new Date(Date.now() + safeDelayMs).toISOString();
    monitorStatusService.updateScheduler({
      schedulerEnabled: true,
      nextRunAt: this.nextRunAt
    });

    this.timer = setTimeout(() => {
      void this.runScheduledMonitor();
    }, safeDelayMs);
  }

  private async runScheduledMonitor(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.timer = null;
    this.nextRunAt = null;
    monitorStatusService.updateScheduler({
      schedulerEnabled: true,
      nextRunAt: null
    });

    if (monitorService.isRunning()) {
      console.log("[scheduler] monitor already running; scheduling next interval");
      this.scheduleNextRun(this.intervalMs);
      return;
    }

    try {
      monitorService.startScheduledMonitor();
      await monitorService.waitForCurrentRun();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scheduler error";
      console.error("[scheduler] scheduled monitor failed", message);
    } finally {
      if (this.enabled) {
        this.scheduleNextRun(this.intervalMs);
      }
    }
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }
}

export const monitorSchedulerService = new MonitorSchedulerService();
