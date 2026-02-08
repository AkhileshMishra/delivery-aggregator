// Basic in-process counters. Replace with Prometheus client for production monitoring.
const counters = new Map<string, number>();

export function increment(metric: string, labels?: Record<string, string>) {
  const key = labels ? `${metric}:${JSON.stringify(labels)}` : metric;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

export function getCounters() {
  return Object.fromEntries(counters);
}
