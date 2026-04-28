import { env } from "../config/env";
import { monitorService } from "./monitor.service";
import { monitorStatusService } from "./monitor-status.service";
import { settingsService } from "./settings.service";

export class MonitorSchedulerService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private enabled = env.ENABLE_BACKGROUND_SCHEDULER;
  private nextRunAt: string | null = null;

  private get intervalMinutes(): number {
    return settingsService.getMonitorIntervalMinutes();
  }

  private get intervalMs(): number {
    return this.intervalMinutes * 60 * 1000;
  }

  start(): void {
    if (!env.ENABLE_SCHEDULER) {
      console.log("[scheduler] Scheduler desabilitado via ENABLE_SCHEDULER=false. Nenhum agendamento automatico sera criado.");
      return;
    }

    if (this.started) {
      return;
    }

    this.started = true;
    this.enabled = settingsService.getSchedulerEnabled();
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

    console.log(`[scheduler] background scheduler enabled; interval ${this.intervalMinutes} minute(s)`);
    this.scheduleNextRun(this.intervalMs);
  }

  pause() {
    this.enabled = false;
    settingsService.setSchedulerEnabled(false);
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
    settingsService.setSchedulerEnabled(true);
    console.log(`[scheduler] resumed; next run in ${this.intervalMinutes} minute(s)`);
    this.scheduleNextRun(this.intervalMs);

    return monitorStatusService.getStatus();
  }

  configure(input: { intervalMinutes?: number; schedulerEnabled?: boolean }) {
    if (input.schedulerEnabled !== undefined) {
      this.enabled = input.schedulerEnabled;
    } else {
      this.enabled = settingsService.getSchedulerEnabled();
    }

    if (!this.started) {
      return monitorStatusService.updateScheduler({
        schedulerEnabled: this.enabled,
        nextRunAt: null
      });
    }

    if (!this.enabled) {
      this.clearTimer();
      this.nextRunAt = null;
      return monitorStatusService.updateScheduler({
        schedulerEnabled: false,
        nextRunAt: null
      });
    }

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
