# Last-Mile Delivery Price Aggregator & Automation Engine — Complete Design

## 1. High-Level Architecture

```
flowchart LR
  A[Client / Upstream App] -->|POST /v1/quotes| B[API Gateway - Fastify]
  B --> C[Request Validator + Time Normalizer - Luxon/SGT]
  C --> D[Dedup Cache - in-memory TTL, success-only]
  D --> E[Orchestrator Service]
  E -->|Promise.allSettled + Semaphore| F1[OpenClaw Runner: GrabExpress]
  E -->|parallel| F2[OpenClaw Runner: Deliveroo SG]
  E -->|parallel| F3[OpenClaw Runner: foodpanda SG]
  E -->|parallel| F4[OpenClaw Runner: uParcel]
  E -->|parallel| F5[OpenClaw Runner: EasyParcel SG]
  E -->|parallel| F6[OpenClaw Runner: Lalamove]
  F1 --> G[Artifact Store - disk]
  F2 --> G
  F3 --> G
  F4 --> G
  F5 --> G
  F6 --> G
  E --> H[Result Aggregator]
  H --> I[Schema Validator - boundary]
  I -->|200 with partials| B
  B --> J[JSON Response]

  K[Health Probe - setInterval, concurrency 2] -->|periodic| F1
  K --> F2
  K --> F3
  K --> F4
  K --> F5
  K --> F6

  L[Operator] -->|POST /v1/reauth/:partnerId| B
  B --> M[Re-Auth Workflow - visible browser]
  M --> N[Cookie capture + encrypt + save]
```

### Key changes from the original design

| Original | Refined | Rationale |
|---|---|---|
| Redis + BullMQ job queue | In-process semaphore (`p-queue`) + `Promise.allSettled` | Single VM — no distributed workers. Eliminates Redis as a dependency. Add BullMQ later if you scale to multiple VMs. |
| Concurrency cap 2–3 | Default 6 (one per partner), configurable | Browser *contexts* (not processes). A 4-core/16GB VM handles 6 comfortably. Profile under load and adjust. |
| Browser profile persistence on disk | Cookie/token store — inject into fresh contexts | Profiles corrupt silently, accumulate cache, are browser-version-sensitive. Extracted cookies are portable and debuggable. |
| No request dedup | Short-TTL dedup cache keyed on `(source, dest, time_bucket)` | Prevents hammering partner portals on duplicate requests within a window. |
| No proactive health checks | Background interval probes per-partner session validity | Avoids discovering stale logins mid-request (which doubles latency). |
| Circuit breaker mentioned but not implemented | Explicit 3-state circuit breaker per partner | Prevents burning browser contexts on a known-down portal. |
| Double schema validation (partner + global) | Single boundary validation with global schema | Partner adapters normalize internally; one validation at the orchestrator boundary is sufficient. |
| Terraform dirs for Azure/GCP | Removed — PowerShell `install.ps1` only | Single VM doesn't need IaC. Add it when multi-env deployment is real. |
| `preferred_pickup_time` default hardcoded | `DEFAULT_PICKUP_OFFSET_MINUTES` in config | Business decision belongs in config, not buried in code. |
| Time normalization via `.replace("Z","+08:00")` | Luxon `DateTime.setZone("Asia/Singapore")` | String replacement mislabels UTC as SGT — off by 8 hours. Luxon handles DST-safe wall-clock conversion. |
| Dedup cache stores all responses | `setCacheIfClean` — only caches when `errors.length === 0` | Prevents transient partner outages from being served to subsequent callers for the TTL window. |
| Health probe: no concurrency limit | Dedicated `p-queue` with concurrency 2 (`HEALTH_PROBE_CONCURRENCY`) | Prevents probes from starving live traffic of CPU/RAM on a small VM. |
| No re-auth workflow | `POST /v1/reauth/:partnerId` — operator-driven or automated per partner | `LoginExpired` transitions are operationally smooth without code changes. Supports both manual (2FA) and automated (password-only) flows. |

---

## 2. Repository Structure

```
delivery-aggregator/
  README.md
  docs/
    architecture.md            # this document
    runbooks.md                # operational playbooks
    partner-notes/
      grabexpress.md
      deliveroo_sg.md
      foodpanda_sg.md
      uparcel.md
      easyparcel_sg.md
      lalamove.md
  infra/
    windows/
      install.ps1              # full VM bootstrap (Node, deps, NSSM services)
      services/
        api-service.nssm.json
  src/
    api/
      server.ts                # Fastify app entry
      routes/
        quotes.controller.ts
      middlewares/
        requestId.ts
        auth.ts
        errorMapper.ts
      schemas/
        quotes.request.ts      # Zod schema
        quotes.response.ts     # Zod schema
    core/
      orchestration/
        orchestrator.ts
        concurrency.ts         # p-queue semaphore wrapper
        dedup.ts               # TTL cache for request dedup
        time.ts                # pickup time normalization
      partners/
        DeliveryPartner.ts     # abstract class + types
        index.ts               # partner registry
        grabexpress/
          GrabExpressPartner.ts
          selectors.ts
        deliveroo_sg/
          DeliverooPartner.ts
          selectors.ts
        foodpanda_sg/
          FoodpandaPartner.ts
          selectors.ts
        uparcel/
          UparcelPartner.ts
          selectors.ts
        easyparcel_sg/
          EasyparcelPartner.ts
          selectors.ts
        lalamove/
          LalamovePartner.ts
          selectors.ts
      openclaw/
        client.ts              # OpenClaw wrapper
        errors.ts              # typed OpenClaw error classes
        sessionStore.ts        # encrypted cookie/token persistence
        artifacts.ts           # screenshot + DOM snapshot capture
      circuit/
        circuitBreaker.ts      # per-partner circuit breaker
      validation/
        schemaGuard.ts         # single boundary validator
      health/
        healthProbe.ts         # background session validity checker (concurrency-guarded)
        healthRoute.ts         # GET /v1/health + POST /v1/reauth/:partnerId
        reauth.ts              # operator-driven re-authentication workflow
      observability/
        logger.ts              # pino structured logger
        metrics.ts             # basic counters/histograms
      config/
        env.ts                 # environment + defaults
        partners.ts            # per-partner config (timeouts, URLs)
        secrets.ts             # secret loading (env vars or encrypted file)
  storage/
    sessions/                  # encrypted cookie/token files (gitignored, NTFS ACLs)
    artifacts/                 # debug packets: screenshots, DOM snapshots
  tests/
    unit/
    contract/                  # schema pinning tests
    e2e/
  .gitignore
  package.json
  tsconfig.json
```
# API Interface & Schemas

## Endpoint

`POST /v1/quotes`

## Request Schema

```ts
// src/api/schemas/quotes.request.ts
import { z } from "zod";

const Location = z.object({
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).refine(d => d.address || (d.lat != null && d.lng != null), {
  message: "Provide either address or lat/lng",
});

export const QuoteRequestSchema = z.object({
  source_location: Location,
  destination_location: Location,
  preferred_pickup_time: z.string().datetime({ offset: true }).nullable().optional(),
});

export type QuoteRequestDTO = z.infer<typeof QuoteRequestSchema>;
```

## Response Schema

```ts
// src/api/schemas/quotes.response.ts
import { z } from "zod";

const PartnerResult = z.object({
  partner: z.string(),
  availability: z.boolean(),
  price: z.object({ amount: z.number().nonnegative(), currency: z.literal("SGD") }),
  estimated_dropoff_time: z.string().datetime({ offset: true }),
  meta: z.record(z.unknown()).optional(),
});

const PartnerError = z.object({
  partner: z.string(),
  type: z.enum([
    "SelectorNotFound", "Timeout", "LoginExpired",
    "SchemaMismatch", "NavigationError", "CircuitOpen", "Unknown",
  ]),
  message: z.string(),
  debug_packet_id: z.string(),
  retryable: z.boolean(),
});

export const QuoteResponseSchema = z.object({
  request_id: z.string().uuid(),
  request_time: z.string().datetime({ offset: true }),
  pickup_time_used: z.string().datetime({ offset: true }),
  currency: z.literal("SGD"),
  results: z.array(PartnerResult),
  errors: z.array(PartnerError),
});

export type QuoteResponseDTO = z.infer<typeof QuoteResponseSchema>;
```

## Example Request

```json
{
  "source_location": { "address": "1 Raffles Place, Singapore", "lat": 1.2847, "lng": 103.8518 },
  "destination_location": { "address": "Changi Airport T3, Singapore", "lat": 1.3574, "lng": 103.9876 },
  "preferred_pickup_time": "2026-02-08T07:30:00+08:00"
}
```

## Example Response

```json
{
  "request_id": "6b7a1c92-8b0f-4bb0-9a7c-5c3a3c0f7f71",
  "request_time": "2026-02-08T05:49:00+08:00",
  "pickup_time_used": "2026-02-08T07:30:00+08:00",
  "currency": "SGD",
  "results": [
    {
      "partner": "lalamove",
      "availability": true,
      "price": { "amount": 12.80, "currency": "SGD" },
      "estimated_dropoff_time": "2026-02-08T08:05:00+08:00",
      "meta": { "service_level": "Motorbike" }
    },
    {
      "partner": "grabexpress",
      "availability": true,
      "price": { "amount": 9.50, "currency": "SGD" },
      "estimated_dropoff_time": "2026-02-08T08:15:00+08:00"
    }
  ],
  "errors": [
    {
      "partner": "deliveroo_sg",
      "type": "LoginExpired",
      "message": "Session invalid; re-login required",
      "debug_packet_id": "dbg_20260208_054901_deliveroo_sg_9f0e",
      "retryable": false
    },
    {
      "partner": "foodpanda_sg",
      "type": "CircuitOpen",
      "message": "Partner circuit open after 3 consecutive failures; next probe in 60s",
      "debug_packet_id": "dbg_20260208_054901_foodpanda_sg_a1b2",
      "retryable": true
    }
  ]
}
```

## Time Normalization Rules

> **Design note:** All internal timestamps are stored as UTC instants. Conversion to
> `Asia/Singapore` (+08:00) happens **only** at the API response boundary. This avoids
> the bug in the previous design where `toISOString().replace("Z", "+08:00")` produced
> a UTC instant mislabeled as SGT (off by 8 hours).

```ts
// src/core/orchestration/time.ts
import { DateTime } from "luxon";
import { env } from "../config/env.js";

const TZ = "Asia/Singapore";

/**
 * Resolves the pickup time to an ISO-8601 string in Asia/Singapore.
 * - If `preferred` is provided (already offset-aware), it is re-zoned to SGT for consistency.
 * - If null/omitted, defaults to requestTime + DEFAULT_PICKUP_OFFSET_MINUTES in SGT.
 */
export function resolvePickupTime(preferred: string | null | undefined, requestTime: Date): string {
  if (preferred) {
    return DateTime.fromISO(preferred).setZone(TZ).toISO()!;
  }
  return DateTime.fromJSDate(requestTime)
    .setZone(TZ)
    .plus({ minutes: env.DEFAULT_PICKUP_OFFSET_MINUTES })
    .toISO()!;
}

/** Format any Date/instant as SGT for API responses. */
export function toSGT(d: Date): string {
  return DateTime.fromJSDate(d).setZone(TZ).toISO()!;
}
```

## Request Deduplication

> **Cache policy:** Only fully-successful responses (where `errors.length === 0`) are cached.
> Partial failures are **never cached** — this prevents a transient partner outage from being
> served to subsequent callers for the TTL duration. The tradeoff is that duplicate requests
> during a partial outage will re-hit the working partners, but this is preferable to hiding
> a recovered partner behind a stale cached error.

```ts
// src/core/orchestration/dedup.ts
import { LRUCache } from "lru-cache";
import type { QuoteResponseDTO } from "../../api/schemas/quotes.response.js";

const cache = new LRUCache<string, QuoteResponseDTO>({ max: 200, ttl: 30_000 }); // 30s TTL

export function dedupKey(src: { lat?: number; lng?: number }, dst: { lat?: number; lng?: number }, pickupBucket: string): string {
  const r = (n?: number) => n != null ? n.toFixed(3) : "?";
  return `${r(src.lat)},${r(src.lng)}|${r(dst.lat)},${r(dst.lng)}|${pickupBucket}`;
}

export function getCached(key: string) { return cache.get(key); }

/** Only cache if all partners succeeded. Partial failures must not be served from cache. */
export function setCacheIfClean(key: string, val: QuoteResponseDTO) {
  if (val.errors.length === 0) cache.set(key, val);
}
```
# Partner Class Design & Session Management

## Abstract Contract

```ts
// src/core/partners/DeliveryPartner.ts
export type PartnerId =
  | "grabexpress" | "deliveroo_sg" | "foodpanda_sg"
  | "uparcel" | "easyparcel_sg" | "lalamove";

export interface QuoteRequest {
  requestId: string;
  source: { address?: string; lat?: number; lng?: number };
  destination: { address?: string; lat?: number; lng?: number };
  pickupTimeISO: string;
}

export interface QuoteResult {
  partner: PartnerId;
  availability: boolean;
  price: { amount: number; currency: "SGD" };
  estimated_dropoff_time: string;
  meta?: Record<string, unknown>;
}

export interface RunContext {
  openclaw: OpenClawClient;
  session: SessionStore;
  artifacts: ArtifactStore;
  config: PartnerConfig;
  logger: Logger;
}

export abstract class DeliveryPartner {
  abstract readonly id: PartnerId;
  abstract ensureAuthenticated(ctx: RunContext): Promise<void>;
  abstract fetchQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResult>;
}
```

## Partner Registry

```ts
// src/core/partners/index.ts
import { GrabExpressPartner } from "./grabexpress/GrabExpressPartner.js";
import { DeliverooPartner } from "./deliveroo_sg/DeliverooPartner.js";
import { FoodpandaPartner } from "./foodpanda_sg/FoodpandaPartner.js";
import { UparcelPartner } from "./uparcel/UparcelPartner.js";
import { EasyparcelPartner } from "./easyparcel_sg/EasyparcelPartner.js";
import { LalamovePartner } from "./lalamove/LalamovePartner.js";
import type { DeliveryPartner } from "./DeliveryPartner.js";

export const partners: DeliveryPartner[] = [
  new GrabExpressPartner(),
  new DeliverooPartner(),
  new FoodpandaPartner(),
  new UparcelPartner(),
  new EasyparcelPartner(),
  new LalamovePartner(),
];
```

## Concrete Partner Example

```ts
// src/core/partners/lalamove/LalamovePartner.ts
import { DeliveryPartner, type RunContext, type QuoteRequest, type QuoteResult } from "../DeliveryPartner.js";
import { LoginExpiredError } from "../../openclaw/errors.js";
import { SELECTORS } from "./selectors.js";

export class LalamovePartner extends DeliveryPartner {
  readonly id = "lalamove" as const;

  async ensureAuthenticated(ctx: RunContext): Promise<void> {
    const cookies = await ctx.session.load(this.id);
    if (!cookies) throw new LoginExpiredError(this.id, "No stored session");
    await ctx.openclaw.setCookies(cookies);
    await ctx.openclaw.goto("https://www.lalamove.com/singapore/en/book");
    const loggedIn = await ctx.openclaw.exists(SELECTORS.userAvatar, { timeout: 5000 });
    if (!loggedIn) throw new LoginExpiredError(this.id, "Cookie session expired");
  }

  async fetchQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResult> {
    await ctx.openclaw.fill(SELECTORS.pickupInput, req.source.address ?? `${req.source.lat},${req.source.lng}`);
    await ctx.openclaw.fill(SELECTORS.dropoffInput, req.destination.address ?? `${req.destination.lat},${req.destination.lng}`);
    await ctx.openclaw.click(SELECTORS.timeSlotPicker);
    await ctx.openclaw.fill(SELECTORS.timeSlotInput, req.pickupTimeISO);
    await ctx.openclaw.waitFor(SELECTORS.priceCard, { timeout: ctx.config.partnerTimeoutMs(this.id) });

    const amount = parseFloat(await ctx.openclaw.textContent(SELECTORS.priceAmount));
    const dropoff = await ctx.openclaw.textContent(SELECTORS.estimatedDropoff);
    const serviceLevel = await ctx.openclaw.textContent(SELECTORS.serviceLevel);

    return {
      partner: this.id,
      availability: true,
      price: { amount, currency: "SGD" },
      estimated_dropoff_time: dropoff,
      meta: { service_level: serviceLevel },
    };
  }
}
```

## Session Store (Cookie/Token Persistence — NOT Browser Profiles)

```ts
// src/core/openclaw/sessionStore.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PartnerId } from "../partners/DeliveryPartner.js";
import { env } from "../config/env.js";

const ALG = "aes-256-gcm";
const DIR = env.SESSION_DIR; // storage/sessions/

export class SessionStore {
  private key: Buffer;

  constructor() {
    // 32-byte key from env or secrets manager
    this.key = Buffer.from(env.SESSION_ENCRYPTION_KEY, "hex");
  }

  private path(partner: PartnerId) { return join(DIR, `${partner}.enc`); }

  async save(partner: PartnerId, cookies: object): Promise<void> {
    await mkdir(DIR, { recursive: true });
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALG, this.key, iv);
    const plain = JSON.stringify(cookies);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv(16) + tag(16) + ciphertext
    await writeFile(this.path(partner), Buffer.concat([iv, tag, encrypted]));
  }

  async load(partner: PartnerId): Promise<object | null> {
    try {
      const buf = await readFile(this.path(partner));
      const iv = buf.subarray(0, 16);
      const tag = buf.subarray(16, 32);
      const encrypted = buf.subarray(32);
      const decipher = createDecipheriv(ALG, this.key, iv);
      decipher.setAuthTag(tag);
      const plain = decipher.update(encrypted) + decipher.final("utf8");
      return JSON.parse(plain);
    } catch {
      return null;
    }
  }
}
```

### Why cookies instead of browser profiles

| Browser profiles on disk | Encrypted cookie store |
|---|---|
| Accumulate cache, grow to 100s of MB | Tiny files (< 10KB per partner) |
| Corrupt silently on browser version upgrades | Version-independent — just HTTP cookies |
| Hard to inspect/debug | JSON — easy to inspect, rotate, audit |
| Must match exact browser binary | Works with any Chromium context |
| Slow to load (full profile init) | Instant injection into fresh context |
# Orchestration, Circuit Breaker & Error Handling

## Error Type Hierarchy

```ts
// src/core/openclaw/errors.ts
export class PartnerError extends Error {
  constructor(
    public readonly partner: string,
    public readonly type: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class SelectorNotFoundError extends PartnerError {
  constructor(partner: string, selector: string) {
    super(partner, "SelectorNotFound", `Selector "${selector}" not found`, false);
  }
}

export class TimeoutError extends PartnerError {
  constructor(partner: string, msg = "Operation timed out") {
    super(partner, "Timeout", msg, true);
  }
}

export class LoginExpiredError extends PartnerError {
  constructor(partner: string, msg = "Session expired") {
    super(partner, "LoginExpired", msg, false);
  }
}

export class SchemaMismatchError extends PartnerError {
  constructor(partner: string, detail: string) {
    super(partner, "SchemaMismatch", detail, false); // NEVER retry
  }
}

export class NavigationError extends PartnerError {
  constructor(partner: string, url: string) {
    super(partner, "NavigationError", `Failed to navigate to ${url}`, true);
  }
}

export class CircuitOpenError extends PartnerError {
  constructor(partner: string) {
    super(partner, "CircuitOpen", `Circuit open — partner skipped`, true);
  }
}
```

## Circuit Breaker (Per-Partner)

```ts
// src/core/circuit/circuitBreaker.ts
type State = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private lastFailure = 0;

  constructor(
    private readonly threshold: number = 3,      // consecutive failures to open
    private readonly cooldownMs: number = 60_000, // time before half-open probe
  ) {}

  get isOpen(): boolean {
    if (this.state === "open" && Date.now() - this.lastFailure > this.cooldownMs) {
      this.state = "half-open";
    }
    return this.state === "open";
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) this.state = "open";
  }
}
```

## Concurrency Control

```ts
// src/core/orchestration/concurrency.ts
import PQueue from "p-queue";
import { env } from "../config/env.js";

// Default: 6 (one per partner). Tune based on VM resources.
export const partnerQueue = new PQueue({ concurrency: env.MAX_BROWSER_CONCURRENCY });
```

## Orchestrator — The Core Loop

```ts
// src/core/orchestration/orchestrator.ts
import { partnerQueue } from "./concurrency.js";
import { partners } from "../partners/index.js";
import { CircuitBreaker } from "../circuit/circuitBreaker.js";
import { CircuitOpenError, PartnerError, SchemaMismatchError } from "../openclaw/errors.js";
import { schemaGuard } from "../validation/schemaGuard.js";
import { QuoteResponseSchema, type QuoteResponseDTO } from "../../api/schemas/quotes.response.js";
import { toSGT } from "./time.js";
import type { QuoteRequest, QuoteResult } from "../partners/DeliveryPartner.js";
import type { RunContext } from "../partners/DeliveryPartner.js";

// One breaker per partner, lives for the process lifetime
const breakers = new Map(partners.map(p => [p.id, new CircuitBreaker()]));

interface PartnerOutcome {
  ok: true; result: QuoteResult;
} | {
  ok: false; error: { partner: string; type: string; message: string; debug_packet_id: string; retryable: boolean };
}

async function runPartnerSafely(
  partner: typeof partners[number],
  ctx: RunContext,
  req: QuoteRequest,
): Promise<PartnerOutcome> {
  const breaker = breakers.get(partner.id)!;

  // 1. Circuit check — skip immediately if open
  if (breaker.isOpen) {
    const pktId = await ctx.artifacts.captureDebugPacket({
      requestId: req.requestId, partner: partner.id,
      errorType: "CircuitOpen", message: "Skipped — circuit open",
    });
    return { ok: false, error: { partner: partner.id, type: "CircuitOpen", message: "Circuit open", debug_packet_id: pktId, retryable: true } };
  }

  try {
    // 2. Auth
    await partner.ensureAuthenticated(ctx);

    // 3. Fetch with timeout
    const result = await withTimeout(
      () => partner.fetchQuote(ctx, req),
      ctx.config.partnerTimeoutMs(partner.id),
    );

    // 4. Single boundary schema validation
    schemaGuard(partner.id, result);

    breaker.recordSuccess();
    return { ok: true, result };

  } catch (err) {
    breaker.recordFailure();
    const classified = err instanceof PartnerError
      ? err
      : new PartnerError(partner.id, "Unknown", String(err), false);

    // 5. Best-effort debug packet — failures here must NOT mask the original error
    const pktId = await captureDebugSafe(ctx, req, partner.id, classified);

    ctx.logger.error("partner_failed", {
      requestId: req.requestId, partner: partner.id,
      errorType: classified.type, debugPacketId: pktId,
    });

    return {
      ok: false,
      error: {
        partner: partner.id,
        type: classified.type,
        message: classified.message,
        debug_packet_id: pktId,
        retryable: classified.retryable,
      },
    };
  }
}

export async function executeQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResponseDTO> {
  const outcomes = await Promise.allSettled(
    partners.map(p => partnerQueue.add(() => runPartnerSafely(p, ctx, req))),
  );

  const results: QuoteResponseDTO["results"] = [];
  const errors: QuoteResponseDTO["errors"] = [];

  for (const o of outcomes) {
    if (o.status === "rejected") continue; // should not happen — runPartnerSafely never throws
    const val = o.value!;
    if (val.ok) results.push(val.result);
    else errors.push(val.error);
  }

  return {
    request_id: req.requestId,
    request_time: toSGT(new Date()),  // timezone-safe via Luxon
    pickup_time_used: req.pickupTimeISO,
    currency: "SGD",
    results,
    errors,
  };
}

// --- helpers ---

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
```

### Key design decisions in the orchestrator

1. `runPartnerSafely` **never throws** — it always returns a discriminated union. This guarantees `Promise.allSettled` always resolves.
2. Circuit breaker check is the **first thing** — no browser context is created for a known-down partner.
3. Schema validation happens **once at the boundary** (not twice). Partner adapters are responsible for normalizing their own data; the orchestrator validates the final shape.
4. Debug packet capture is wrapped in `safe()` at every level — a failure to screenshot never hides the real error.
5. `SchemaMismatchError` is **never retried** — it indicates a portal UI change or extraction bug that requires human intervention.

## Schema Guard (Boundary Validator)

```ts
// src/core/validation/schemaGuard.ts
import { z } from "zod";
import { SchemaMismatchError } from "../openclaw/errors.js";
import type { QuoteResult } from "../partners/DeliveryPartner.js";

const QuoteResultSchema = z.object({
  partner: z.string(),
  availability: z.boolean(),
  price: z.object({ amount: z.number().nonnegative(), currency: z.literal("SGD") }),
  estimated_dropoff_time: z.string(),
  meta: z.record(z.unknown()).optional(),
});

export function schemaGuard(partnerId: string, data: unknown): QuoteResult {
  const parsed = QuoteResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new SchemaMismatchError(partnerId, parsed.error.message);
  }
  return parsed.data as QuoteResult;
}
```
# Health Probes, Observability & Operations

## Proactive Health Probe

Runs on a background interval. Validates each partner's session *before* real requests hit.

> **Concurrency guard:** The health probe runs on its own `p-queue` with concurrency 2
> (configurable via `HEALTH_PROBE_CONCURRENCY`). This ensures probes cannot starve live
> traffic of browser contexts on a small VM. The probe queue is separate from the main
> `partnerQueue` used by `/v1/quotes`, so the two never compete for the same semaphore
> slots — but they do share physical CPU/RAM, hence the low default.

```ts
// src/core/health/healthProbe.ts
import PQueue from "p-queue";
import { partners } from "../partners/index.js";
import { SessionStore } from "../openclaw/sessionStore.js";
import { OpenClawClient } from "../openclaw/client.js";
import { logger } from "../observability/logger.js";
import { env } from "../config/env.js";

export interface PartnerHealth {
  partner: string;
  sessionValid: boolean;
  lastChecked: string;
  error?: string;
}

const state = new Map<string, PartnerHealth>();
const probeQueue = new PQueue({ concurrency: env.HEALTH_PROBE_CONCURRENCY }); // default: 2

export async function probeAll(): Promise<void> {
  await Promise.allSettled(
    partners.map(p => probeQueue.add(() => probeOne(p))),
  );
}

async function probeOne(p: typeof partners[number]): Promise<void> {
  const client = new OpenClawClient();
  try {
    const session = new SessionStore();
    const cookies = await session.load(p.id);
    if (!cookies) { update(p.id, false, "No stored session"); return; }
    await client.setCookies(cookies);
    await p.ensureAuthenticated({ openclaw: client, session } as any);
    update(p.id, true);
  } catch (err: any) {
    update(p.id, false, err.message);
    logger.warn("health_probe_failed", { partner: p.id, error: err.message });
  } finally {
    await client.close();
  }
}

function update(partner: string, valid: boolean, error?: string) {
  state.set(partner, { partner, sessionValid: valid, lastChecked: new Date().toISOString(), error });
}

export function getHealthSnapshot(): PartnerHealth[] {
  return [...state.values()];
}

// Start background probe
setInterval(probeAll, env.HEALTH_PROBE_INTERVAL_MS);
```

## Health Endpoint

```ts
// src/core/health/healthRoute.ts
import type { FastifyInstance } from "fastify";
import { getHealthSnapshot } from "./healthProbe.js";
import { reauth } from "./reauth.js";

export function registerHealthRoute(app: FastifyInstance) {
  app.get("/v1/health", async () => {
    const partners = getHealthSnapshot();
    const allHealthy = partners.every(p => p.sessionValid);
    return { status: allHealthy ? "healthy" : "degraded", partners };
  });

  // Operator-triggered re-authentication for a specific partner
  app.post("/v1/reauth/:partnerId", async (request, reply) => {
    const { partnerId } = request.params as { partnerId: string };
    const result = await reauth(partnerId);
    return reply.status(result.ok ? 200 : 500).send(result);
  });
}
```

### Example health response

```json
{
  "status": "degraded",
  "partners": [
    { "partner": "grabexpress", "sessionValid": true, "lastChecked": "2026-02-08T13:50:00+08:00" },
    { "partner": "deliveroo_sg", "sessionValid": false, "lastChecked": "2026-02-08T13:50:01+08:00", "error": "Cookie session expired" },
    { "partner": "lalamove", "sessionValid": true, "lastChecked": "2026-02-08T13:50:02+08:00" }
  ]
}
```

## Re-Auth Workflow

> **Operational context:** When a partner session expires (`LoginExpired`), the system
> cannot automatically re-login — most partner portals require OTP, CAPTCHA, or manual
> credential entry. Instead, the system exposes a `POST /v1/reauth/:partnerId` endpoint
> that an operator calls after manually completing the login in a browser. The endpoint
> launches an OpenClaw browser (visible, not headless) for the operator to interact with,
> then captures and encrypts the resulting cookies.
>
> For fully automated partners (username/password only, no 2FA), the partner class can
> override `performLogin()` to automate the flow.

```ts
// src/core/health/reauth.ts
import { partners } from "../partners/index.js";
import { OpenClawClient } from "../openclaw/client.js";
import { SessionStore } from "../openclaw/sessionStore.js";
import { logger } from "../observability/logger.js";
import type { PartnerId } from "../partners/DeliveryPartner.js";

export async function reauth(partnerId: string): Promise<{ ok: boolean; message: string }> {
  const partner = partners.find(p => p.id === partnerId);
  if (!partner) return { ok: false, message: `Unknown partner: ${partnerId}` };

  const client = new OpenClawClient({ headless: false }); // visible browser for operator
  const session = new SessionStore();

  try {
    if (partner.performLogin) {
      // Partner supports automated login (no 2FA)
      await partner.performLogin({ openclaw: client, session } as any);
    } else {
      // Manual flow: navigate to login page, wait for operator to complete
      await client.goto(partner.loginUrl);
      logger.info("reauth_waiting", { partner: partnerId, message: "Waiting for operator login..." });
      await client.waitForNavigation({ url: partner.postLoginUrl, timeout: 300_000 }); // 5 min
    }

    const cookies = await client.getCookies();
    await session.save(partner.id as PartnerId, cookies);
    logger.info("reauth_success", { partner: partnerId });
    return { ok: true, message: `Session refreshed for ${partnerId}` };
  } catch (err: any) {
    logger.error("reauth_failed", { partner: partnerId, error: err.message });
    return { ok: false, message: err.message };
  } finally {
    await client.close();
  }
}
```

Updated abstract class additions for re-auth support:

```ts
// Addition to src/core/partners/DeliveryPartner.ts
export abstract class DeliveryPartner {
  abstract readonly id: PartnerId;
  abstract readonly loginUrl: string;       // partner login page
  abstract readonly postLoginUrl: string;   // URL pattern that indicates successful login

  abstract ensureAuthenticated(ctx: RunContext): Promise<void>;
  abstract fetchQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResult>;

  /** Override for partners that support fully automated login (no 2FA/CAPTCHA). */
  performLogin?(ctx: RunContext): Promise<void>;
}
```

## Debug Artifact Store

```ts
// src/core/openclaw/artifacts.ts
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";

export interface DebugPacketInput {
  requestId: string;
  partner: string;
  errorType: string;
  message: string;
  failedAt?: string;
  stack?: string;
  domSnapshot?: string | null;
  screenshotPath?: string | null;
  url?: string | null;
}

export class ArtifactStore {
  async captureDebugPacket(input: DebugPacketInput): Promise<string> {
    const id = `dbg_${input.partner}_${randomBytes(4).toString("hex")}`;
    const dir = join(env.ARTIFACTS_DIR, id);
    await mkdir(dir, { recursive: true });

    await writeFile(join(dir, "meta.json"), JSON.stringify({
      ...input, debugPacketId: id, capturedAt: new Date().toISOString(),
    }, null, 2));

    if (input.domSnapshot) await writeFile(join(dir, "dom.html"), input.domSnapshot);
    // screenshotPath is already saved by OpenClaw; just record the reference

    return id;
  }
}
```

## Configuration

```ts
// src/core/config/env.ts
export const env = {
  PORT: parseInt(process.env.PORT ?? "3000"),
  MAX_BROWSER_CONCURRENCY: parseInt(process.env.MAX_BROWSER_CONCURRENCY ?? "6"),
  DEFAULT_PICKUP_OFFSET_MINUTES: parseInt(process.env.DEFAULT_PICKUP_OFFSET_MINUTES ?? "60"),
  SESSION_DIR: process.env.SESSION_DIR ?? "./storage/sessions",
  ARTIFACTS_DIR: process.env.ARTIFACTS_DIR ?? "./storage/artifacts",
  SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY ?? "", // REQUIRED — fail fast if missing
  HEALTH_PROBE_INTERVAL_MS: parseInt(process.env.HEALTH_PROBE_INTERVAL_MS ?? "300000"), // 5 min
  HEALTH_PROBE_CONCURRENCY: parseInt(process.env.HEALTH_PROBE_CONCURRENCY ?? "2"), // low to avoid starving live traffic
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
} as const;

if (!env.SESSION_ENCRYPTION_KEY) throw new Error("SESSION_ENCRYPTION_KEY is required");
```

```ts
// src/core/config/partners.ts
import type { PartnerId } from "../partners/DeliveryPartner.js";

interface PartnerCfg {
  timeoutMs: number;
  circuitThreshold: number;
  circuitCooldownMs: number;
}

const defaults: PartnerCfg = { timeoutMs: 30_000, circuitThreshold: 3, circuitCooldownMs: 60_000 };

const overrides: Partial<Record<PartnerId, Partial<PartnerCfg>>> = {
  grabexpress: { timeoutMs: 45_000 }, // known to be slower
};

export function partnerConfig(id: PartnerId): PartnerCfg {
  return { ...defaults, ...overrides[id] };
}
```

## API Server Entry

```ts
// src/api/server.ts
import Fastify from "fastify";
import { QuoteRequestSchema } from "./schemas/quotes.request.js";
import { executeQuote } from "../core/orchestration/orchestrator.js";
import { resolvePickupTime, toSGT } from "../core/orchestration/time.js";
import { dedupKey, getCached, setCacheIfClean } from "../core/orchestration/dedup.js";
import { registerHealthRoute } from "../core/health/healthRoute.js";
import { env } from "../core/config/env.js";
import { randomUUID } from "node:crypto";

const app = Fastify({ logger: true });

app.post("/v1/quotes", async (request, reply) => {
  const parsed = QuoteRequestSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

  const body = parsed.data;
  const now = new Date();
  const pickupTime = resolvePickupTime(body.preferred_pickup_time, now);
  const key = dedupKey(body.source_location, body.destination_location, pickupTime.slice(0, 16));

  const cached = getCached(key);
  if (cached) return cached;

  const ctx = buildRunContext(); // wire up OpenClaw client, session store, artifacts, logger
  const result = await executeQuote(ctx, {
    requestId: randomUUID(),
    source: body.source_location,
    destination: body.destination_location,
    pickupTimeISO: pickupTime,
  });

  setCacheIfClean(key, result); // only cache fully-successful responses
  return result;
});

registerHealthRoute(app);

app.listen({ port: env.PORT, host: "0.0.0.0" });
```

## Windows Service Setup (NSSM)

```powershell
# infra/windows/install.ps1

# 1. Install Node.js LTS (if not present)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    winget install OpenJS.NodeJS.LTS --accept-package-agreements
}

# 2. Install dependencies
Set-Location C:\delivery-aggregator
npm ci --production

# 3. Lock down session storage
$sessionPath = "C:\delivery-aggregator\storage\sessions"
icacls $sessionPath /inheritance:r /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /grant "Administrators:(OI)(CI)F"

# 4. Register as Windows service via NSSM
nssm install DeliveryAggregator "C:\Program Files\nodejs\node.exe"
nssm set DeliveryAggregator AppParameters "C:\delivery-aggregator\dist\api\server.js"
nssm set DeliveryAggregator AppDirectory "C:\delivery-aggregator"
nssm set DeliveryAggregator AppEnvironmentExtra "SESSION_ENCRYPTION_KEY=<your-64-char-hex>" "NODE_ENV=production"
nssm set DeliveryAggregator AppStdout "C:\delivery-aggregator\logs\stdout.log"
nssm set DeliveryAggregator AppStderr "C:\delivery-aggregator\logs\stderr.log"
nssm set DeliveryAggregator AppRotateFiles 1
nssm set DeliveryAggregator AppRotateBytes 10485760
nssm start DeliveryAggregator
```

---

## Summary of All Gaps Closed

| Gap | How it's addressed |
|---|---|
| Concurrency too conservative | Default 6, configurable via `MAX_BROWSER_CONCURRENCY` |
| Redis overkill for single VM | Replaced with `p-queue` + `Promise.allSettled` |
| Browser profile fragility | Cookie/token store with AES-256-GCM encryption |
| No request dedup | LRU cache with 30s TTL, coords rounded to ~100m |
| Dedup cache hides partner outages | `setCacheIfClean` — only caches fully-successful responses |
| No proactive health checks | Background interval probe + `GET /v1/health` |
| Health probe competes with live traffic | Dedicated `p-queue` with concurrency 2 (`HEALTH_PROBE_CONCURRENCY`) |
| Circuit breaker missing | 3-state breaker per partner (closed → open → half-open) |
| Double schema validation | Single boundary validation via `schemaGuard()` |
| Pickup time default hardcoded | `DEFAULT_PICKUP_OFFSET_MINUTES` in env config |
| Time normalization bug (UTC mislabeled as SGT) | Luxon `DateTime.setZone("Asia/Singapore")` — all internal instants are UTC, SGT formatting at API boundary only |
| No re-auth workflow | `POST /v1/reauth/:partnerId` — supports manual (2FA) and automated (password-only) flows |
| Terraform premature | Removed — PowerShell `install.ps1` only |
