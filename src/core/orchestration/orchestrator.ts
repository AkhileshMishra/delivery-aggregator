import { partnerQueue } from "./concurrency.js";
import { partners } from "../partners/index.js";
import { CircuitBreaker } from "../circuit/circuitBreaker.js";
import { PartnerError } from "../openclaw/errors.js";
import { OpenClawClient } from "../openclaw/client.js";
import { schemaGuard } from "../validation/schemaGuard.js";
import { toSGT } from "./time.js";
import { normalizeDropoffTime } from "./time.js";
import { partnerConfig } from "../config/partners.js";
import { increment } from "../observability/metrics.js";
import type { QuoteResponseDTO } from "../../api/schemas/quotes.response.js";
import type { QuoteRequest, QuoteResult, RunContext, SharedContext, DeliveryPartner } from "../partners/DeliveryPartner.js";

const breakers = new Map(partners.map((p) => [p.id, new CircuitBreaker(
  partnerConfig(p.id).circuitThreshold,
  partnerConfig(p.id).circuitCooldownMs,
)]));

type PartnerOutcome =
  | { ok: true; result: QuoteResult }
  | { ok: false; error: QuoteResponseDTO["errors"][number] };

const MAX_RETRIES = 1; // one retry for transient errors

async function runPartnerSafely(
  partner: DeliveryPartner,
  shared: SharedContext,
  req: QuoteRequest,
): Promise<PartnerOutcome> {
  const breaker = breakers.get(partner.id)!;

  if (breaker.isOpen) {
    increment("partner_circuit_open", { partner: partner.id });
    const pktId = await shared.artifacts.captureDebugPacket({
      requestId: req.requestId,
      partner: partner.id,
      errorType: "CircuitOpen",
      message: "Skipped — circuit open",
    });
    return { ok: false, error: { partner: partner.id, type: "CircuitOpen", message: "Circuit open", debug_packet_id: pktId, retryable: true } };
  }

  let lastErr: PartnerError | null = null;
  let lastDebugPktId: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Each attempt gets its own isolated browser context
    const client = new OpenClawClient();
    const ctx: RunContext = { openclaw: client, ...shared };

    try {
      await partner.ensureAuthenticated(ctx);

      const result = await withTimeout(
        () => partner.fetchQuote(ctx, req),
        ctx.config.partnerTimeoutMs(partner.id),
      );

      // Normalize dropoff time to ISO-8601 SGT
      result.estimated_dropoff_time = normalizeDropoffTime(result.estimated_dropoff_time);

      schemaGuard(partner.id, result);
      breaker.recordSuccess();
      increment("partner_success", { partner: partner.id });
      return { ok: true, result };
    } catch (err) {
      const classified = err instanceof PartnerError
        ? err
        : new PartnerError(partner.id, "Unknown", String(err), false);
      lastErr = classified;

      // Capture debug packet BEFORE closing the browser so DOM/screenshot are available
      lastDebugPktId = await captureDebugSafe(ctx, shared, req, partner.id, classified);

      // Only retry transient errors
      if (!classified.retryable || attempt >= MAX_RETRIES) break;

      shared.logger.warn({ partner: partner.id, attempt, errorType: classified.type }, "partner_retry");
    } finally {
      await client.close();
    }
  }

  // All attempts exhausted
  breaker.recordFailure();
  increment("partner_failure", { partner: lastErr!.partner, type: lastErr!.type });

  shared.logger.error({ requestId: req.requestId, partner: partner.id, errorType: lastErr!.type, debugPacketId: lastDebugPktId }, "partner_failed");

  return {
    ok: false,
    error: {
      partner: partner.id,
      type: lastErr!.type as QuoteResponseDTO["errors"][number]["type"],
      message: lastErr!.message,
      debug_packet_id: lastDebugPktId ?? `dbg_no_capture_${Date.now()}`,
      retryable: lastErr!.retryable,
    },
  };
}

export async function executeQuote(shared: SharedContext, req: QuoteRequest): Promise<QuoteResponseDTO> {
  increment("quotes_requested");

  const outcomes = await Promise.allSettled(
    partners.map((p) => partnerQueue.add(() => runPartnerSafely(p, shared, req))),
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

async function captureDebugSafe(ctx: RunContext, shared: SharedContext, req: QuoteRequest, partner: string, err: PartnerError): Promise<string> {
  try {
    return await shared.artifacts.captureDebugPacket({
      requestId: req.requestId,
      partner,
      failedAt: new Date().toISOString(),
      errorType: err.type,
      message: err.message,
      stack: err.stack,
      // Best-effort: browser is still open here, so DOM/screenshot/URL are available.
      // safe() ensures a failure to capture any of these does not hide the root error.
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
