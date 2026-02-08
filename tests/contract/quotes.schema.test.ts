import { describe, it, expect } from "vitest";
import { QuoteResponseSchema } from "../../src/api/schemas/quotes.response.js";

describe("QuoteResponseSchema", () => {
  it("accepts a valid full response", () => {
    const valid = {
      request_id: "6b7a1c92-8b0f-4bb0-9a7c-5c3a3c0f7f71",
      request_time: "2026-02-08T13:49:00+08:00",
      pickup_time_used: "2026-02-08T14:49:00+08:00",
      currency: "SGD",
      results: [
        {
          partner: "lalamove",
          availability: true,
          price: { amount: 12.8, currency: "SGD" },
          estimated_dropoff_time: "2026-02-08T15:05:00+08:00",
          meta: { service_level: "Motorbike" },
        },
      ],
      errors: [],
    };
    expect(QuoteResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a response with partial errors", () => {
    const partial = {
      request_id: "6b7a1c92-8b0f-4bb0-9a7c-5c3a3c0f7f71",
      request_time: "2026-02-08T13:49:00+08:00",
      pickup_time_used: "2026-02-08T14:49:00+08:00",
      currency: "SGD",
      results: [],
      errors: [
        {
          partner: "deliveroo_sg",
          type: "LoginExpired",
          message: "Session expired",
          debug_packet_id: "dbg_deliveroo_sg_abc123",
          retryable: false,
        },
      ],
    };
    expect(QuoteResponseSchema.safeParse(partial).success).toBe(true);
  });

  it("rejects invalid currency", () => {
    const invalid = {
      request_id: "6b7a1c92-8b0f-4bb0-9a7c-5c3a3c0f7f71",
      request_time: "2026-02-08T13:49:00+08:00",
      pickup_time_used: "2026-02-08T14:49:00+08:00",
      currency: "USD",
      results: [],
      errors: [],
    };
    expect(QuoteResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects negative price", () => {
    const invalid = {
      request_id: "6b7a1c92-8b0f-4bb0-9a7c-5c3a3c0f7f71",
      request_time: "2026-02-08T13:49:00+08:00",
      pickup_time_used: "2026-02-08T14:49:00+08:00",
      currency: "SGD",
      results: [
        {
          partner: "lalamove",
          availability: true,
          price: { amount: -5, currency: "SGD" },
          estimated_dropoff_time: "2026-02-08T15:05:00+08:00",
        },
      ],
      errors: [],
    };
    expect(QuoteResponseSchema.safeParse(invalid).success).toBe(false);
  });
});
