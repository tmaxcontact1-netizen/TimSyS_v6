import { Decimal } from "decimal.js";

declare const brand: unique symbol;

export type Brand<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

export type TokenId = Brand<string, "TokenId">;
export type PoolId = Brand<string, "PoolId">;
export type WalletId = Brand<string, "WalletId">;
export type CandidateId = Brand<string, "CandidateId">;
export type SignalId = Brand<string, "SignalId">;
export type OrderId = Brand<string, "OrderId">;
export type PositionId = Brand<string, "PositionId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type AuditEventId = Brand<string, "AuditEventId">;
export type MintAddress = Brand<string, "MintAddress">;
export type WalletAddress = Brand<string, "WalletAddress">;
export type Timestamp = Brand<string, "Timestamp">;
export type StrategyVersionId = Brand<string, "StrategyVersionId">;
export type RuleId = Brand<string, "RuleId">;
export type SolanaSlot = Brand<bigint, "SolanaSlot">;
export type RawAmount = Brand<bigint, "RawAmount">;
export type BasisPoints = Brand<bigint, "BasisPoints">;
export type Percentage = Brand<Decimal, "Percentage">;
export type DecimalValue = Brand<Decimal, "DecimalValue">;

export type ProviderId =
  "solana_rpc" | "helius" | "jupiter" | "dexscreener" | "gmgn" | "birdeye" | "telegram";

export type Result<Value, ErrorValue> =
  Readonly<{ ok: true; value: Value }> | Readonly<{ ok: false; error: ErrorValue }>;

export const ok = <Value>(value: Value): Result<Value, never> => ({ ok: true, value });
export const err = <ErrorValue>(error: ErrorValue): Result<never, ErrorValue> => ({
  ok: false,
  error,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RULE_ID_PATTERN = /^[A-Z]{3}-\d{3}$/;
const STRATEGY_VERSION_PATTERN = /^strategy-v\d+\.\d+\.\d+$/;

export function asUuid<Value extends Brand<string, string>>(value: string): Value {
  if (!UUID_PATTERN.test(value)) throw new TypeError(`Invalid UUID: ${value}`);
  return value as Value;
}

export function asTimestamp(value: string | Date): Timestamp {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError(`Invalid timestamp: ${String(value)}`);
  return instant.toISOString() as Timestamp;
}

export function asStrategyVersionId(value: string): StrategyVersionId {
  if (!STRATEGY_VERSION_PATTERN.test(value))
    throw new TypeError(`Invalid strategy version: ${value}`);
  return value as StrategyVersionId;
}

export function asRuleId(value: string): RuleId {
  if (!RULE_ID_PATTERN.test(value)) throw new TypeError(`Invalid rule ID: ${value}`);
  return value as RuleId;
}

function asNonNegativeBigInt<Name extends string>(
  value: bigint,
  label: string,
): Brand<bigint, Name> {
  if (value < 0n) throw new RangeError(`${label} must be non-negative`);
  return value as Brand<bigint, Name>;
}

export const asSolanaSlot = (value: bigint): SolanaSlot =>
  asNonNegativeBigInt<"SolanaSlot">(value, "Solana slot");
export const asRawAmount = (value: bigint): RawAmount =>
  asNonNegativeBigInt<"RawAmount">(value, "Raw amount");

export function asBasisPoints(value: bigint): BasisPoints {
  if (value < 0n || value > 10_000n)
    throw new RangeError("Basis points must be between 0 and 10000");
  return value as BasisPoints;
}

export function asDecimal(value: Decimal.Value): DecimalValue {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new RangeError("Decimal value must be finite");
  return decimal as DecimalValue;
}

export function asNonNegativeDecimal(value: Decimal.Value): DecimalValue {
  const decimal = asDecimal(value);
  if (decimal.isNegative()) throw new RangeError("Decimal value must be non-negative");
  return decimal;
}

export function asPercentage(value: Decimal.Value): Percentage {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new RangeError("Percentage must be finite");
  if (decimal.lt(0) || decimal.gt(100))
    throw new RangeError("Percentage must be between 0 and 100");
  return decimal as Percentage;
}
