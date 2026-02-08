import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { QuoteRequestSchema } from "../schemas/quotes.request.js";
import { executeQuote } from "../../core/orchestration/orchestrator.js";
import { resolvePickupTime } from "../../core/orchestration/time.js";
import { dedupKey, getCached, setCacheIfClean } from "../../core/orchestration/dedup.js";
import { OpenClawClient } from "../../core/openclaw/client.js";
import { SessionStore } from "../../core/openclaw/sessionStore.js";
import { ArtifactStore } from "../../core/openclaw/artifacts.js";
import { partnerConfig } from "../../core/config/partners.js";
import { logger } from "../../core/observability/logger.js";
import type { PartnerId } from "../../core/partners/DeliveryPartner.js";

/** Shared singletons — no need to recreate per request */
const session = new SessionStore();
const artifacts = new ArtifactStore();

export function registerQuotesRoute(app: FastifyInstance) {
  app.post("/v1/quotes", async (request, reply) => {
    const parsed = QuoteRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const body = parsed.data;
    const now = new Date();
    const pickupTime = resolvePickupTime(body.preferred_pickup_time, now);
    const key = dedupKey(body.source_location, body.destination_location, pickupTime.slice(0, 16));

    const cached = getCached(key);
    if (cached) return cached;

    // Each request gets its own OpenClaw client — the orchestrator creates
    // per-partner clients internally for context isolation.
    const ctx = {
      session,
      artifacts,
      config: { partnerTimeoutMs: (id: PartnerId) => partnerConfig(id).timeoutMs },
      logger,
    };

    const result = await executeQuote(ctx, {
      requestId: randomUUID(),
      source: body.source_location,
      destination: body.destination_location,
      pickupTimeISO: pickupTime,
    });

    setCacheIfClean(key, result);
    return result;
  });
}
