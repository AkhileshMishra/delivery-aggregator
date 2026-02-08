import type { FastifyInstance } from "fastify";
import { env } from "../../core/config/env.js";

/**
 * API key auth — required when API_KEY is set (which it should always be in production).
 * Health endpoint is exempt so monitoring can probe without auth.
 */
export function registerAuth(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    // Allow health checks without auth
    if (request.url === "/v1/health") return;

    if (!env.API_KEY) {
      // No API key configured — reject all requests in production safety
      return reply.status(500).send({ error: "Server misconfigured: API_KEY not set" });
    }

    const key = request.headers["x-api-key"];
    if (key !== env.API_KEY) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
