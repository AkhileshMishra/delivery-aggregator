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
const probeQueue = new PQueue({ concurrency: env.HEALTH_PROBE_CONCURRENCY });

export async function probeAll(): Promise<void> {
  await Promise.allSettled(partners.map((p) => probeQueue.add(() => probeOne(p))));
}

async function probeOne(p: (typeof partners)[number]): Promise<void> {
  const client = new OpenClawClient();
  try {
    const session = new SessionStore();
    const cookies = await session.load(p.id);
    if (!cookies) {
      update(p.id, false, "No stored session");
      return;
    }
    await client.setCookies(cookies);
    await p.ensureAuthenticated({ openclaw: client, session } as any);
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
  setInterval(probeAll, env.HEALTH_PROBE_INTERVAL_MS);
  // Run once immediately on startup
  probeAll().catch(() => {});
}
