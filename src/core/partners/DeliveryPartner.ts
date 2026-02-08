import type { OpenClawClient } from "../openclaw/client.js";
import type { SessionStore } from "../openclaw/sessionStore.js";
import type { ArtifactStore } from "../openclaw/artifacts.js";
import type { Logger } from "pino";

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
  config: { partnerTimeoutMs: (id: PartnerId) => number };
  logger: Logger;
}

export abstract class DeliveryPartner {
  abstract readonly id: PartnerId;
  abstract readonly loginUrl: string;
  abstract readonly postLoginUrl: string;

  abstract ensureAuthenticated(ctx: RunContext): Promise<void>;
  abstract fetchQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResult>;

  /** Override for partners that support fully automated login (no 2FA/CAPTCHA). */
  performLogin?(ctx: RunContext): Promise<void>;
}
