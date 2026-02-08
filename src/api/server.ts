import Fastify from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { env } from "../core/config/env.js";
import { registerRequestId } from "./middlewares/requestId.js";
import { registerAuth } from "./middlewares/auth.js";
import { registerErrorMapper } from "./middlewares/errorMapper.js";
import { registerQuotesRoute } from "./routes/quotes.controller.js";
import { registerHealthRoutes } from "../core/health/healthRoute.js";
import { startHealthProbe, stopHealthProbe } from "../core/health/healthProbe.js";
import { startArtifactCleanup, stopArtifactCleanup } from "../core/openclaw/artifacts.js";
import { logger } from "../core/observability/logger.js";

const app = Fastify({
  logger: true,
  requestTimeout: env.REQUEST_TIMEOUT_MS,
});

// Rate limiting
await app.register(fastifyRateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  keyGenerator: (request) => request.headers["x-api-key"] as string || request.ip,
});

registerRequestId(app);
registerAuth(app);
registerErrorMapper(app);
registerQuotesRoute(app);
registerHealthRoutes(app);

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  stopHealthProbe();
  stopArtifactCleanup();
  await app.close();
  logger.info("Server closed");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    logger.fatal(err, "Failed to start server");
    process.exit(1);
  }
  logger.info(`Server running on port ${env.PORT}`);
  startHealthProbe();
  startArtifactCleanup();
});
