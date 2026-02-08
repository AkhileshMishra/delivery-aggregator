import type { FastifyInstance } from "fastify";
import { logger } from "../../core/observability/logger.js";

export function registerErrorMapper(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, "unhandled_error");
    reply.status(500).send({ error: "Internal server error" });
  });
}
