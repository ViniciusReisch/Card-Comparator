import { closeDatabase } from "../src/db/database";
import { runMigrations } from "../src/db/migrations";
import { env } from "../src/config/env";

runMigrations();
console.log(`[db] initialized at ${env.DATABASE_PATH}`);
closeDatabase();

