export class InvariantViolationError extends Error {
  public override readonly name: string = "InvariantViolationError";
}

export class InvalidTransitionError extends InvariantViolationError {
  public override readonly name: string = "InvalidTransitionError";
  public constructor(from: string, to: string) {
    super(`Invalid state transition from ${from} to ${to}`);
  }
}

export class ContractViolationError extends Error {
  public override readonly name: string = "ContractViolationError";
}
