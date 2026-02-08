import type { PartnerId } from "../partners/DeliveryPartner.js";

interface PartnerCfg {
  timeoutMs: number;
  circuitThreshold: number;
  circuitCooldownMs: number;
}

const defaults: PartnerCfg = { timeoutMs: 30_000, circuitThreshold: 3, circuitCooldownMs: 60_000 };

const overrides: Partial<Record<PartnerId, Partial<PartnerCfg>>> = {
  grabexpress: { timeoutMs: 45_000 },
};

export function partnerConfig(id: PartnerId): PartnerCfg {
  return { ...defaults, ...overrides[id] };
}
