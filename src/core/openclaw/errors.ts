export class PartnerError extends Error {
  constructor(
    public readonly partner: string,
    public readonly type: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PartnerError";
  }
}

export class SelectorNotFoundError extends PartnerError {
  constructor(partner: string, selector: string) {
    super(partner, "SelectorNotFound", `Selector "${selector}" not found`, false);
  }
}

export class TimeoutError extends PartnerError {
  constructor(partner: string, msg = "Operation timed out") {
    super(partner, "Timeout", msg, true);
  }
}

export class LoginExpiredError extends PartnerError {
  constructor(partner: string, msg = "Session expired") {
    super(partner, "LoginExpired", msg, false);
  }
}

export class SchemaMismatchError extends PartnerError {
  constructor(partner: string, detail: string) {
    super(partner, "SchemaMismatch", detail, false);
  }
}

export class NavigationError extends PartnerError {
  constructor(partner: string, url: string) {
    super(partner, "NavigationError", `Failed to navigate to ${url}`, true);
  }
}

export class CircuitOpenError extends PartnerError {
  constructor(partner: string) {
    super(partner, "CircuitOpen", "Circuit open — partner skipped", true);
  }
}
