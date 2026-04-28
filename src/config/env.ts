import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((value) => ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()));

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default("./storage/monitor.sqlite"),
  HEADLESS: booleanFromEnv(true),
  SLOW_MO: z.coerce.number().int().min(0).default(0),
  REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(6000),
  LIGA_MAX_VER_MAIS_CLICKS: z.coerce.number().int().min(1).default(100),
  LIGA_POKEMON_PROXY_URL: z.string().default(""),
  CARDTRADER_MAX_PAGES: z.coerce.number().int().min(1).default(200),
  MONITOR_STATUS_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(1500),
  DETAIL_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  CARD_DETAIL_TIMEOUT_MS: z.coerce.number().int().min(5_000).default(45_000),
  SCRAPER_FAST_MODE: booleanFromEnv(false),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  VITE_API_URL: z.string().default(""),
  ENABLE_BACKGROUND_SCHEDULER: booleanFromEnv(true),
  MONITOR_INTERVAL_MINUTES: z.coerce.number().min(1).default(10),
  RUN_ON_BOOT: booleanFromEnv(true),
  ENABLE_REMOTE_ACCESS: booleanFromEnv(true),
  REMOTE_ACCESS_MODE: z.string().default("cloudflare_tunnel"),
  APP_PUBLIC_URL: z.string().default(""),
  API_PUBLIC_URL: z.string().default(""),
  CLOUDFLARED_BIN: z.string().min(1).default("cloudflared"),
  CLOUDFLARE_TUNNEL_TARGET: z.string().min(1).default("http://localhost:3333"),
  CLOUDFLARE_TUNNEL_HOSTNAME: z.string().default(""),
  NTFY_ENABLED: booleanFromEnv(false),
  NTFY_BASE_URL: z.string().url().default("https://ntfy.sh"),
  NTFY_TOPIC: z.string().default(""),
  NTFY_PRIORITY: z.string().default("default"),
  TELEGRAM_ENABLED: booleanFromEnv(false),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_CHAT_ID: z.string().default(""),
  MYP_ENABLED: booleanFromEnv(true),
  MYP_MAX_PAGES: z.coerce.number().int().min(1).default(100),
  MYP_REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(1200),
  MYP_CARD_TIMEOUT_MS: z.coerce.number().int().min(5_000).default(20_000),
  // Feature flags
  ENABLE_SCHEDULER: booleanFromEnv(true),
  ENABLE_BETA_SAFE_MODE: booleanFromEnv(false),
  ENABLE_ADMIN_DANGEROUS_ACTIONS: booleanFromEnv(true),
  // Para integração futura com HWheelsHub — desabilitado por padrão neste projeto
  ENABLE_WHEELZ_SCRAPER: booleanFromEnv(false)
});

export const env = envSchema.parse(process.env);
