type State = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private lastFailure = 0;

  constructor(
    private readonly threshold: number = 3,
    private readonly cooldownMs: number = 60_000,
  ) {}

  get isOpen(): boolean {
    if (this.state === "open" && Date.now() - this.lastFailure > this.cooldownMs) {
      this.state = "half-open";
    }
    return this.state === "open";
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) this.state = "open";
  }
}
