import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default("./storage/monitor.sqlite"),
  HEADLESS: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  SLOW_MO: z.coerce.number().int().min(0).default(0),
  REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(1500),
  LIGA_MAX_VER_MAIS_CLICKS: z.coerce.number().int().min(1).default(100),
  CARDTRADER_MAX_PAGES: z.coerce.number().int().min(1).default(200),
  MONITOR_STATUS_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(1500),
  DETAIL_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  CARD_DETAIL_TIMEOUT_MS: z.coerce.number().int().min(5_000).default(20_000),
  SCRAPER_FAST_MODE: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  VITE_API_URL: z.string().url().default("http://localhost:3333")
});

export const env = envSchema.parse(process.env);
