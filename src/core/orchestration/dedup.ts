import { LRUCache } from "lru-cache";
import type { QuoteResponseDTO } from "../../api/schemas/quotes.response.js";

const cache = new LRUCache<string, QuoteResponseDTO>({ max: 200, ttl: 30_000 });

export function dedupKey(
  src: { lat?: number; lng?: number },
  dst: { lat?: number; lng?: number },
  pickupBucket: string,
): string {
  const r = (n?: number) => (n != null ? n.toFixed(3) : "?");
  return `${r(src.lat)},${r(src.lng)}|${r(dst.lat)},${r(dst.lng)}|${pickupBucket}`;
}

export function getCached(key: string) {
  return cache.get(key);
}

/** Only cache fully-successful responses. Partial failures must not be served from cache. */
export function setCacheIfClean(key: string, val: QuoteResponseDTO) {
  if (val.errors.length === 0) cache.set(key, val);
}
