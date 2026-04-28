import { closeDatabase } from "../src/db/database";
import { runMigrations } from "../src/db/migrations";
import { monitorService } from "../src/services/monitor.service";

async function main(): Promise<void> {
  runMigrations();
  const summary = await monitorService.runManualMonitor();
  console.log(
    `[monitor] status=${summary.status} cards=${summary.totalCardsFound} offers=${summary.totalOffersFound} new=${summary.newOffersFound}`
  );
}

main()
  .catch((error) => {
    console.error("[monitor] fatal error", error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });

