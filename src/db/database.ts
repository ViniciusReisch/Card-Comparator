import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { env } from "../config/env";

let database: Database.Database | null = null;

function resolveDatabasePath(databasePath: string): string {
  if (path.isAbsolute(databasePath)) {
    return databasePath;
  }

  return path.resolve(process.cwd(), databasePath);
}

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  const resolvedPath = resolveDatabasePath(env.DATABASE_PATH);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });

  database = new Database(resolvedPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  return database;
}

export function closeDatabase(): void {
  if (!database) {
    return;
  }

  database.close();
  database = null;
}

