import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export function registerRequestId(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    (request as any).requestId = request.headers["x-request-id"] ?? randomUUID();
  });
}
