import Fastify from "fastify";
import { env } from "../core/config/env.js";
import { registerRequestId } from "./middlewares/requestId.js";
import { registerAuth } from "./middlewares/auth.js";
import { registerErrorMapper } from "./middlewares/errorMapper.js";
import { registerQuotesRoute } from "./routes/quotes.controller.js";
import { registerHealthRoutes } from "../core/health/healthRoute.js";
import { startHealthProbe } from "../core/health/healthProbe.js";
import { logger } from "../core/observability/logger.js";

const app = Fastify({ logger: true });

registerRequestId(app);
registerAuth(app);
registerErrorMapper(app);
registerQuotesRoute(app);
registerHealthRoutes(app);

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    logger.fatal(err, "Failed to start server");
    process.exit(1);
  }
  logger.info(`Server running on port ${env.PORT}`);
  startHealthProbe();
});
