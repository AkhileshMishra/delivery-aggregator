import { describe, it, expect } from "vitest";
import { dedupKey, getCached, setCacheIfClean } from "../../src/core/orchestration/dedup.js";
import type { QuoteResponseDTO } from "../../src/api/schemas/quotes.response.js";

describe("dedupKey", () => {
  it("rounds coordinates to 3 decimal places", () => {
    const key = dedupKey({ lat: 1.28471, lng: 103.85182 }, { lat: 1.35741, lng: 103.98762 }, "2026-02-08T07:30");
    expect(key).toBe("1.285,103.852|1.357,103.988|2026-02-08T07:30");
  });

  it("uses ? for missing coordinates", () => {
    const key = dedupKey({}, {}, "2026-02-08T07:30");
    expect(key).toBe("?,?|?,?|2026-02-08T07:30");
  });
});

describe("setCacheIfClean / getCached", () => {
  it("caches fully successful responses", () => {
    const resp: QuoteResponseDTO = {
      request_id: "test-id",
      request_time: "2026-02-08T13:49:00+08:00",
      pickup_time_used: "2026-02-08T14:49:00+08:00",
      currency: "SGD",
      results: [{ partner: "lalamove", availability: true, price: { amount: 10, currency: "SGD" }, estimated_dropoff_time: "2026-02-08T15:00:00+08:00" }],
      errors: [],
    };
    setCacheIfClean("test-key", resp);
    expect(getCached("test-key")).toEqual(resp);
  });

  it("does not cache partial failures", () => {
    const resp: QuoteResponseDTO = {
      request_id: "test-id-2",
      request_time: "2026-02-08T13:49:00+08:00",
      pickup_time_used: "2026-02-08T14:49:00+08:00",
      currency: "SGD",
      results: [],
      errors: [{ partner: "test", type: "Timeout", message: "timeout", debug_packet_id: "dbg", retryable: true }],
    };
    setCacheIfClean("test-key-2", resp);
    expect(getCached("test-key-2")).toBeUndefined();
  });
});
