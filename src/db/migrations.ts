import { readFileSync } from "node:fs";
import path from "node:path";
import { getDatabase } from "./database";

export function runMigrations(): void {
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf8");
  const database = getDatabase();

  database.exec(schemaSql);
}

