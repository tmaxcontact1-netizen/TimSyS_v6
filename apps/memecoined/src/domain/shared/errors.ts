export const DOMAIN_ERROR_CODES = {
  INVALID_VALUE: "DOMAIN_INVALID_VALUE",
  INVARIANT_VIOLATION: "DOMAIN_INVARIANT_VIOLATION",
  INVALID_TRANSITION: "DOMAIN_INVALID_TRANSITION",
  MISSING_EVIDENCE: "DOMAIN_MISSING_EVIDENCE",
} as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES];

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: Readonly<Record<string, string>>;

  public constructor(
    code: DomainErrorCode,
    message: string,
    details: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class InvariantViolationError extends DomainError {
  public constructor(message: string, details: Readonly<Record<string, string>> = {}) {
    super(DOMAIN_ERROR_CODES.INVARIANT_VIOLATION, message, details);
    this.name = "InvariantViolationError";
  }
}

export class InvalidTransitionError<State extends string> extends DomainError {
  public readonly from: State;
  public readonly to: State;

  public constructor(from: State, to: State) {
    super(
      DOMAIN_ERROR_CODES.INVALID_TRANSITION,
      `Transition from ${from} to ${to} is not allowed`,
      {
        from,
        to,
      },
    );
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}
