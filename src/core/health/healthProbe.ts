import PQueue from "p-queue";
import { partners } from "../partners/index.js";
import { SessionStore } from "../openclaw/sessionStore.js";
import { OpenClawClient } from "../openclaw/client.js";
import { ArtifactStore } from "../openclaw/artifacts.js";
import { logger } from "../observability/logger.js";
import { env } from "../config/env.js";
import type { PartnerId } from "../partners/DeliveryPartner.js";
import { partnerConfig } from "../config/partners.js";

export interface PartnerHealth {
  partner: string;
  sessionValid: boolean;
  lastChecked: string;
  error?: string;
}

const state = new Map<string, PartnerHealth>();
const probeQueue = new PQueue({ concurrency: env.HEALTH_PROBE_CONCURRENCY });
let probeInterval: ReturnType<typeof setInterval> | null = null;

/** Singleton — avoid recreating per probe */
const session = new SessionStore();

export async function probeAll(): Promise<void> {
  await Promise.allSettled(partners.map((p) => probeQueue.add(() => probeOne(p))));
}

async function probeOne(p: (typeof partners)[number]): Promise<void> {
  const client = new OpenClawClient();
  try {
    const cookies = await session.load(p.id);
    if (!cookies) {
      update(p.id, false, "No stored session");
      return;
    }
    await client.setCookies(cookies);
    await p.ensureAuthenticated({
      openclaw: client,
      session,
      artifacts: new ArtifactStore(),
      config: { partnerTimeoutMs: (id: PartnerId) => partnerConfig(id).timeoutMs },
      logger,
    });
    update(p.id, true);
  } catch (err: any) {
    update(p.id, false, err.message);
    logger.warn({ partner: p.id, error: err.message }, "health_probe_failed");
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

export function startHealthProbe() {
  probeInterval = setInterval(probeAll, env.HEALTH_PROBE_INTERVAL_MS);
  probeAll().catch(() => {});
}

export function stopHealthProbe() {
  if (probeInterval) {
    clearInterval(probeInterval);
    probeInterval = null;
  }
}
