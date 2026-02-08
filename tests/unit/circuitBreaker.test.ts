import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../../src/core/circuit/circuitBreaker.js";

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const cb = new CircuitBreaker(3, 1000);
    expect(cb.isOpen).toBe(false);
  });

  it("opens after threshold failures", () => {
    const cb = new CircuitBreaker(3, 1000);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it("resets on success", () => {
    const cb = new CircuitBreaker(3, 1000);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
  });

  it("transitions to half-open after cooldown", async () => {
    const cb = new CircuitBreaker(1, 50);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
    await new Promise((r) => setTimeout(r, 60));
    // After cooldown, isOpen returns false (half-open allows a probe)
    expect(cb.isOpen).toBe(false);
  });
});
