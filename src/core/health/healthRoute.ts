import type { FastifyInstance } from "fastify";
import { getHealthSnapshot } from "./healthProbe.js";
import { reauth } from "./reauth.js";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/v1/health", async () => {
    const partners = getHealthSnapshot();
    const allHealthy = partners.every((p) => p.sessionValid);
    return { status: allHealthy ? "healthy" : "degraded", partners };
  });

  app.post<{ Params: { partnerId: string } }>("/v1/reauth/:partnerId", async (request, reply) => {
    const { partnerId } = request.params;
    const result = await reauth(partnerId);
    return reply.status(result.ok ? 200 : 500).send(result);
  });
}
