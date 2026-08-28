import { createHash, randomBytes, randomUUID } from "node:crypto";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";

export type OperatorApprovalAction =
  | "entry"
  | "position_close"
  | "emergency_action"
  | "configuration_activation";
export type OperatorApprovalDecision = "approve" | "reject";

export interface OperatorApprovalRequest {
  readonly id: string;
  readonly actionType: OperatorApprovalAction;
  readonly targetType: string;
  readonly targetId: string;
  readonly payloadHash: string;
  readonly eligibilityHash: string;
  readonly quoteFingerprint: string | null;
  readonly nonce: string;
  readonly nonceHash: string;
  readonly requestedBy: string;
  readonly requestedAt: Timestamp;
  readonly expiresAt: Timestamp;
}

export interface OperatorApprovalStore {
  request(input: OperatorApprovalRequest): Promise<void>;
  decide(input: {
    id: string;
    nonceHash: string;
    decision: OperatorApprovalDecision;
    actorId: string;
    reason: string | null;
    decidedAt: Timestamp;
  }): Promise<void>;
  consume(input: {
    id: string;
    payloadHash: string;
    eligibilityHash: string;
    quoteFingerprint: string | null;
    actorId: string;
    consumedAt: Timestamp;
  }): Promise<void>;
  expireDue(at: Timestamp): Promise<number>;
}

const lifetimes: Readonly<Record<OperatorApprovalAction, number>> = Object.freeze({
  entry: 15_000,
  position_close: 60_000,
  emergency_action: 300_000,
  configuration_activation: 300_000,
});

function requireText(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvariantViolationError(`${name} is required`);
  return trimmed;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new InvariantViolationError("Approval payload is invalid");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  throw new InvariantViolationError("Approval payload contains an unsupported value");
}

export function operatorApprovalPayloadHash(payload: unknown): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class OperatorApprovalService {
  public constructor(
    private readonly store: OperatorApprovalStore,
    private readonly now: () => Timestamp,
  ) {}

  public async request(input: {
    actionType: OperatorApprovalAction;
    targetType: string;
    targetId: string;
    payload: unknown;
    eligibilityHash: string;
    quoteFingerprint?: string | null;
    requestedBy: string;
  }): Promise<OperatorApprovalRequest> {
    const requestedAt = this.now();
    const nonce = randomBytes(32).toString("base64url");
    const request = Object.freeze({
      id: randomUUID(),
      actionType: input.actionType,
      targetType: requireText(input.targetType, "Approval target type"),
      targetId: requireText(input.targetId, "Approval target identity"),
      payloadHash: operatorApprovalPayloadHash(input.payload),
      eligibilityHash: requireText(input.eligibilityHash, "Approval eligibility hash"),
      quoteFingerprint:
        input.quoteFingerprint === undefined || input.quoteFingerprint === null
          ? null
          : requireText(input.quoteFingerprint, "Approval quote fingerprint"),
      nonce,
      nonceHash: hash(nonce),
      requestedBy: requireText(input.requestedBy, "Approval requester"),
      requestedAt,
      expiresAt: asTimestamp(new Date(Date.parse(requestedAt) + lifetimes[input.actionType])),
    });
    if (input.actionType === "entry" && request.quoteFingerprint === null)
      throw new InvariantViolationError("Entry approval requires a quote fingerprint");
    await this.store.request(request);
    return request;
  }

  public decide(input: {
    id: string;
    nonce: string;
    decision: OperatorApprovalDecision;
    actorId: string;
    reason?: string | null;
  }): Promise<void> {
    return this.store.decide({
      id: requireText(input.id, "Approval identity"),
      nonceHash: hash(requireText(input.nonce, "Approval nonce")),
      decision: input.decision,
      actorId: requireText(input.actorId, "Approval actor"),
      reason: input.reason?.trim() || null,
      decidedAt: this.now(),
    });
  }

  public consume(input: {
    id: string;
    payload: unknown;
    eligibilityHash: string;
    quoteFingerprint?: string | null;
    actorId: string;
  }): Promise<void> {
    return this.store.consume({
      id: requireText(input.id, "Approval identity"),
      payloadHash: operatorApprovalPayloadHash(input.payload),
      eligibilityHash: requireText(input.eligibilityHash, "Approval eligibility hash"),
      quoteFingerprint: input.quoteFingerprint ?? null,
      actorId: requireText(input.actorId, "Approval consumer"),
      consumedAt: this.now(),
    });
  }

  public expireDue(): Promise<number> {
    return this.store.expireDue(this.now());
  }
}
