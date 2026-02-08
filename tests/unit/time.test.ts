import { describe, it, expect } from "vitest";
import { normalizeDropoffTime, resolvePickupTime, toSGT } from "../../src/core/orchestration/time.js";

describe("resolvePickupTime", () => {
  it("returns preferred time re-zoned to SGT", () => {
    const result = resolvePickupTime("2026-02-08T00:00:00Z", new Date());
    expect(result).toContain("+08:00");
  });

  it("defaults to now + offset when no preferred time", () => {
    const now = new Date("2026-02-08T00:00:00Z");
    const result = resolvePickupTime(null, now);
    // Should be 60 min after now in SGT
    expect(result).toContain("2026-02-08T09:00:00");
  });
});

describe("toSGT", () => {
  it("converts UTC date to SGT ISO string", () => {
    const result = toSGT(new Date("2026-02-08T00:00:00Z"));
    expect(result).toBe("2026-02-08T08:00:00.000+08:00");
  });
});

describe("normalizeDropoffTime", () => {
  it("passes through valid ISO-8601", () => {
    const result = normalizeDropoffTime("2026-02-08T15:05:00+08:00");
    expect(result).toContain("2026-02-08T15:05:00");
    expect(result).toContain("+08:00");
  });

  it("converts UTC ISO to SGT", () => {
    const result = normalizeDropoffTime("2026-02-08T07:05:00Z");
    expect(result).toContain("2026-02-08T15:05:00");
    expect(result).toContain("+08:00");
  });

  it("parses 12-hour time format", () => {
    const result = normalizeDropoffTime("3:05 PM");
    expect(result).toContain("15:05");
    expect(result).toContain("+08:00");
  });

  it("returns raw string for unparseable input", () => {
    const result = normalizeDropoffTime("garbage");
    expect(result).toBe("garbage");
  });

  it("handles empty string", () => {
    const result = normalizeDropoffTime("");
    expect(result).toBe("");
  });
});
