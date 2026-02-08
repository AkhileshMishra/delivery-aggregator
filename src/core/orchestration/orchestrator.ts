import { partnerQueue } from "./concurrency.js";
import { partners } from "../partners/index.js";
import { CircuitBreaker } from "../circuit/circuitBreaker.js";
import { PartnerError } from "../openclaw/errors.js";
import { schemaGuard } from "../validation/schemaGuard.js";
import { toSGT } from "./time.js";
import { partnerConfig } from "../config/partners.js";
import type { QuoteResponseDTO } from "../../api/schemas/quotes.response.js";
import type { QuoteRequest, QuoteResult, RunContext, DeliveryPartner } from "../partners/DeliveryPartner.js";

const breakers = new Map(partners.map((p) => [p.id, new CircuitBreaker(
  partnerConfig(p.id).circuitThreshold,
  partnerConfig(p.id).circuitCooldownMs,
)]));

type PartnerOutcome =
  | { ok: true; result: QuoteResult }
  | { ok: false; error: QuoteResponseDTO["errors"][number] };

async function runPartnerSafely(
  partner: DeliveryPartner,
  ctx: RunContext,
  req: QuoteRequest,
): Promise<PartnerOutcome> {
  const breaker = breakers.get(partner.id)!;

  if (breaker.isOpen) {
    const pktId = await ctx.artifacts.captureDebugPacket({
      requestId: req.requestId,
      partner: partner.id,
      errorType: "CircuitOpen",
      message: "Skipped — circuit open",
    });
    return { ok: false, error: { partner: partner.id, type: "CircuitOpen", message: "Circuit open", debug_packet_id: pktId, retryable: true } };
  }

  try {
    await partner.ensureAuthenticated(ctx);

    const result = await withTimeout(
      () => partner.fetchQuote(ctx, req),
      ctx.config.partnerTimeoutMs(partner.id),
    );

    schemaGuard(partner.id, result);
    breaker.recordSuccess();
    return { ok: true, result };
  } catch (err) {
    breaker.recordFailure();
    const classified = err instanceof PartnerError
      ? err
      : new PartnerError(partner.id, "Unknown", String(err), false);

    const pktId = await captureDebugSafe(ctx, req, partner.id, classified);

    ctx.logger.error({ requestId: req.requestId, partner: partner.id, errorType: classified.type, debugPacketId: pktId }, "partner_failed");

    return {
      ok: false,
      error: {
        partner: partner.id,
        type: classified.type as QuoteResponseDTO["errors"][number]["type"],
        message: classified.message,
        debug_packet_id: pktId,
        retryable: classified.retryable,
      },
    };
  }
}

export async function executeQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResponseDTO> {
  const outcomes = await Promise.allSettled(
    partners.map((p) => partnerQueue.add(() => runPartnerSafely(p, ctx, req))),
  );

  const results: QuoteResponseDTO["results"] = [];
  const errors: QuoteResponseDTO["errors"] = [];

  for (const o of outcomes) {
    if (o.status === "rejected") continue;
    const val = o.value!;
    if (val.ok) results.push(val.result);
    else errors.push(val.error);
  }

  return {
    request_id: req.requestId,
    request_time: toSGT(new Date()),
    pickup_time_used: req.pickupTimeISO,
    currency: "SGD",
    results,
    errors,
  };
}

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PartnerError("", "Timeout", `Exceeded ${ms}ms`, true)), ms);
    fn().then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function captureDebugSafe(ctx: RunContext, req: QuoteRequest, partner: string, err: PartnerError): Promise<string> {
  try {
    return await ctx.artifacts.captureDebugPacket({
      requestId: req.requestId,
      partner,
      failedAt: new Date().toISOString(),
      errorType: err.type,
      message: err.message,
      stack: err.stack,
      domSnapshot: await safe(() => ctx.openclaw.dumpDom()),
      screenshotPath: await safe(() => ctx.openclaw.screenshot()),
      url: await safe(() => ctx.openclaw.currentUrl()),
    });
  } catch {
    return `dbg_capture_failed_${Date.now()}`;
  }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}
