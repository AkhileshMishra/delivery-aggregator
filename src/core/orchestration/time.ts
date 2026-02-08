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
