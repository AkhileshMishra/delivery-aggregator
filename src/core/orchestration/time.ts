import { DateTime } from "luxon";
import { env } from "../config/env.js";

const TZ = "Asia/Singapore";

export function resolvePickupTime(preferred: string | null | undefined, requestTime: Date): string {
  if (preferred) {
    return DateTime.fromISO(preferred).setZone(TZ).toISO()!;
  }
  return DateTime.fromJSDate(requestTime)
    .setZone(TZ)
    .plus({ minutes: env.DEFAULT_PICKUP_OFFSET_MINUTES })
    .toISO()!;
}

export function toSGT(d: Date): string {
  return DateTime.fromJSDate(d).setZone(TZ).toISO()!;
}

/**
 * Normalize a dropoff time string scraped from a partner portal into ISO-8601 SGT.
 * Handles common formats: ISO-8601, "8:05 AM", "8:05 PM", "2026-02-08 08:05", etc.
 * Falls back to the raw string if parsing fails (schema guard will catch it).
 */
export function normalizeDropoffTime(raw: string): string {
  // Already valid ISO-8601 with offset
  const isoAttempt = DateTime.fromISO(raw);
  if (isoAttempt.isValid) return isoAttempt.setZone(TZ).toISO()!;

  // Try common formats partners might display
  const formats = [
    "h:mm a",           // "8:05 AM"
    "hh:mm a",          // "08:05 AM"
    "H:mm",             // "8:05" (24h)
    "HH:mm",            // "08:05" (24h)
    "yyyy-MM-dd HH:mm", // "2026-02-08 08:05"
    "dd/MM/yyyy HH:mm", // "08/02/2026 08:05"
    "dd MMM yyyy HH:mm", // "08 Feb 2026 08:05"
    "EEE, dd MMM HH:mm", // "Sat, 08 Feb 08:05"
  ];

  for (const fmt of formats) {
    const parsed = DateTime.fromFormat(raw.trim(), fmt, { zone: TZ });
    if (parsed.isValid) {
      // For time-only formats, assume today in SGT
      return parsed.setZone(TZ).toISO()!;
    }
  }

  // Return raw — schemaGuard will flag it as SchemaMismatch if it's not valid datetime
  return raw;
}
