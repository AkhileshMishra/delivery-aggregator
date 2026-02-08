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
  API_KEY: process.env.API_KEY ?? "",
  /** Max concurrent in-flight quote requests (queued beyond this) */
  MAX_INFLIGHT_REQUESTS: parseInt(process.env.MAX_INFLIGHT_REQUESTS ?? "10"),
  /** Overall request timeout in ms */
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS ?? "60000"),
  /** Rate limit: max requests per window */
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX ?? "30"),
  /** Rate limit window in ms */
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),
  /** Max age in ms for artifact cleanup (default 24h) */
  ARTIFACTS_MAX_AGE_MS: parseInt(process.env.ARTIFACTS_MAX_AGE_MS ?? "86400000"),
} as const;

if (!env.SESSION_ENCRYPTION_KEY) throw new Error("SESSION_ENCRYPTION_KEY is required");
