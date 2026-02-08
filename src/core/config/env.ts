export const env = {
  PORT: parseInt(process.env.PORT ?? "3000"),
  MAX_BROWSER_CONCURRENCY: parseInt(process.env.MAX_BROWSER_CONCURRENCY ?? "6"),
  DEFAULT_PICKUP_OFFSET_MINUTES: parseInt(process.env.DEFAULT_PICKUP_OFFSET_MINUTES ?? "60"),
  SESSION_DIR: process.env.SESSION_DIR ?? "./storage/sessions",
  ARTIFACTS_DIR: process.env.ARTIFACTS_DIR ?? "./storage/artifacts",
  SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY ?? "",
  HEALTH_PROBE_INTERVAL_MS: parseInt(process.env.HEALTH_PROBE_INTERVAL_MS ?? "300000"),
  HEALTH_PROBE_CONCURRENCY: parseInt(process.env.HEALTH_PROBE_CONCURRENCY ?? "2"),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
} as const;

if (!env.SESSION_ENCRYPTION_KEY) throw new Error("SESSION_ENCRYPTION_KEY is required");
