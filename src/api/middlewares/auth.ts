import type { FastifyInstance } from "fastify";

/** Placeholder — wire up API key or JWT validation here. */
export function registerAuth(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const key = request.headers["x-api-key"];
    if (process.env.API_KEY && key !== process.env.API_KEY) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
