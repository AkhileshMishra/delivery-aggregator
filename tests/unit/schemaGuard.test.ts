import { describe, it, expect } from "vitest";
import { schemaGuard } from "../../src/core/validation/schemaGuard.js";

describe("schemaGuard", () => {
  it("accepts valid available result", () => {
    const result = schemaGuard("test", {
      partner: "test",
      availability: true,
      price: { amount: 10, currency: "SGD" },
      estimated_dropoff_time: "2026-02-08T15:00:00+08:00",
    });
    expect(result.partner).toBe("test");
  });

  it("accepts unavailable result with zero price", () => {
    const result = schemaGuard("test", {
      partner: "test",
      availability: false,
      price: { amount: 0, currency: "SGD" },
      estimated_dropoff_time: "",
    });
    expect(result.availability).toBe(false);
  });

  it("rejects available result with zero price", () => {
    expect(() =>
      schemaGuard("test", {
        partner: "test",
        availability: true,
        price: { amount: 0, currency: "SGD" },
        estimated_dropoff_time: "2026-02-08T15:00:00+08:00",
      }),
    ).toThrow("zero/negative price");
  });

  it("rejects available result with empty dropoff time", () => {
    expect(() =>
      schemaGuard("test", {
        partner: "test",
        availability: true,
        price: { amount: 10, currency: "SGD" },
        estimated_dropoff_time: "",
      }),
    ).toThrow("empty dropoff time");
  });

  it("rejects invalid shape", () => {
    expect(() => schemaGuard("test", { partner: "test" })).toThrow();
  });
});
