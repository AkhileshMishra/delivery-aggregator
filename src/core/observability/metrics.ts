// In-process counters and histograms. Replace with prom-client for Prometheus scraping.
const counters = new Map<string, number>();
const histograms = new Map<string, number[]>();

export function increment(metric: string, labels?: Record<string, string>) {
  const key = labels ? `${metric}:${JSON.stringify(labels)}` : metric;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

export function recordDuration(metric: string, durationMs: number, labels?: Record<string, string>) {
  const key = labels ? `${metric}:${JSON.stringify(labels)}` : metric;
  const arr = histograms.get(key) ?? [];
  arr.push(durationMs);
  // Keep last 1000 samples
  if (arr.length > 1000) arr.shift();
  histograms.set(key, arr);
}

export function getCounters() {
  return Object.fromEntries(counters);
}

export function getHistograms() {
  const result: Record<string, { count: number; p50: number; p95: number; p99: number }> = {};
  for (const [key, values] of histograms) {
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    result[key] = {
      count: len,
      p50: sorted[Math.floor(len * 0.5)] ?? 0,
      p95: sorted[Math.floor(len * 0.95)] ?? 0,
      p99: sorted[Math.floor(len * 0.99)] ?? 0,
    };
  }
  return result;
}
